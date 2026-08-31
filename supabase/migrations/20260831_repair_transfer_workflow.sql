-- MTS Lab repair transfer workflow
-- The application already models RepairTransferRequest in Prisma. This migration
-- adds the database-level uniqueness and atomic RPCs required by the API.

create unique index if not exists "RepairTransferRequest_one_pending_per_repair_idx"
  on "RepairTransferRequest" ("repairId")
  where "status" = 'PENDING';

create or replace function public.create_repair_transfer_request(
  p_repair_id uuid,
  p_target_technician_id uuid,
  p_reason text,
  p_sender_technician_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_repair "Repair"%rowtype;
  v_sender "User"%rowtype;
  v_target "User"%rowtype;
  v_existing "RepairTransferRequest"%rowtype;
  v_request "RepairTransferRequest"%rowtype;
  v_now timestamptz := now();
begin
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception using errcode = 'P0001', message = 'Transfer reason must contain at least 3 characters.';
  end if;

  select * into v_sender
  from "User"
  where id = p_sender_technician_id
    and "deletedAt" is null
    and "isActive" = true
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'Sender technician is not active.';
  end if;

  if upper(replace(coalesce(v_sender.role, ''), ' ', '_')) not in ('TECHNICIAN', 'LEAD_TECHNICIAN', 'HEAD_TECHNICIAN') then
    raise exception using errcode = 'P0001', message = 'Only technicians can create repair transfer requests.';
  end if;

  select * into v_target
  from "User"
  where id = p_target_technician_id
    and "deletedAt" is null
    and "isActive" = true
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'Selected technician is inactive or unavailable.';
  end if;

  if v_target.id = v_sender.id then
    raise exception using errcode = 'P0001', message = 'A repair cannot be transferred to the same technician.';
  end if;

  if upper(replace(coalesce(v_target.role, ''), ' ', '_')) not in ('TECHNICIAN', 'LEAD_TECHNICIAN', 'HEAD_TECHNICIAN') then
    raise exception using errcode = 'P0001', message = 'Selected user is not an eligible technician.';
  end if;

  if coalesce(v_sender."branchId", '') <> coalesce(v_target."branchId", '') then
    raise exception using errcode = 'P0001', message = 'The selected technician belongs to a different branch.';
  end if;

  select * into v_repair
  from "Repair"
  where id = p_repair_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'Repair not found.';
  end if;

  if v_repair."technicianId" is distinct from v_sender.id then
    raise exception using errcode = 'P0001', message = 'You can only transfer repairs currently assigned to you.';
  end if;

  if v_repair.status in ('DELIVERED', 'CANCELLED', 'ARCHIVED') then
    raise exception using errcode = 'P0001', message = 'This repair cannot be transferred in its current status.';
  end if;

  select * into v_existing
  from "RepairTransferRequest"
  where "repairId" = p_repair_id
    and "status" = 'PENDING'
  limit 1
  for update;

  if found then
    raise exception using errcode = '23505', message = 'A transfer request is already pending for this repair.';
  end if;

  insert into "RepairTransferRequest" (
    "id", "repairId", "repairNumber", "senderTechnicianId", "senderTechnicianName",
    "targetTechnicianId", "targetTechnicianName", "reason", "status", "createdAt", "updatedAt"
  ) values (
    gen_random_uuid(), v_repair.id, v_repair."repairNumber", v_sender.id, v_sender.name,
    v_target.id, v_target.name, trim(p_reason), 'PENDING', v_now, v_now
  )
  returning * into v_request;

  insert into "Notification" (
    "id", "userId", "title", "message", "type", "repairId", "repairNumber",
    "senderId", "senderName", "metadata", "isRead", "createdAt"
  ) values (
    gen_random_uuid(),
    v_target.id,
    'Repair Transfer Request',
    'Technician ' || v_sender.name || ' requested to transfer repair #' || v_repair."repairNumber" || ' to you.',
    'TRANSFER_REQUEST',
    v_repair.id,
    v_repair."repairNumber",
    v_sender.id,
    v_sender.name,
    jsonb_build_object('transferRequestId', v_request.id, 'repairId', v_repair.id)::text,
    false,
    v_now
  );

  insert into "AuditLog" (
    "id", "userId", "userEmail", "userName", "userRole", "action", "resource", "resourceId", "status", "details", "createdAt"
  ) values (
    gen_random_uuid(), v_sender.id, v_sender.email, v_sender.name, v_sender.role,
    'REPAIR_TRANSFER_REQUESTED', 'RepairTransferRequest', v_request.id, 'SUCCESS',
    jsonb_build_object('repairId', v_repair.id, 'repairNumber', v_repair."repairNumber", 'targetTechnicianId', v_target.id)::text,
    v_now
  );

  return jsonb_build_object(
    'id', v_request.id,
    'repairId', v_request."repairId",
    'repairNumber', v_request."repairNumber",
    'senderTechnicianId', v_request."senderTechnicianId",
    'senderTechnicianName', v_request."senderTechnicianName",
    'targetTechnicianId', v_request."targetTechnicianId",
    'targetTechnicianName', v_request."targetTechnicianName",
    'reason', v_request.reason,
    'status', v_request.status,
    'createdAt', v_request."createdAt"
  );
end;
$$;

create or replace function public.respond_repair_transfer_request(
  p_request_id uuid,
  p_receiver_technician_id uuid,
  p_action text,
  p_response_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request "RepairTransferRequest"%rowtype;
  v_repair "Repair"%rowtype;
  v_receiver "User"%rowtype;
  v_sender "User"%rowtype;
  v_now timestamptz := now();
  v_action text := upper(trim(p_action));
  v_status text;
  v_message text;
begin
  if v_action not in ('ACCEPT', 'REJECT') then
    raise exception using errcode = 'P0001', message = 'Invalid transfer response.';
  end if;

  select * into v_receiver
  from "User"
  where id = p_receiver_technician_id
    and "deletedAt" is null
    and "isActive" = true
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'Receiving technician is inactive or unavailable.';
  end if;

  select * into v_request
  from "RepairTransferRequest"
  where id = p_request_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'Transfer request not found.';
  end if;

  if v_request."targetTechnicianId" <> v_receiver.id then
    raise exception using errcode = 'P0001', message = 'You are not authorized to respond to this transfer request.';
  end if;

  if v_request.status <> 'PENDING' then
    raise exception using errcode = '23505', message = 'Transfer request has already been processed.';
  end if;

  select * into v_repair
  from "Repair"
  where id = v_request."repairId"
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'Repair no longer exists.';
  end if;

  select * into v_sender
  from "User"
  where id = v_request."senderTechnicianId"
    and "deletedAt" is null
  limit 1;

  if v_action = 'ACCEPT' then
    if v_repair."technicianId" is distinct from v_request."senderTechnicianId" then
      raise exception using errcode = '23505', message = 'Repair assignment changed before this transfer was accepted.';
    end if;

    if v_repair.status in ('DELIVERED', 'CANCELLED', 'ARCHIVED') then
      raise exception using errcode = '23505', message = 'This repair can no longer be transferred.';
    end if;

    update "Repair"
    set "technicianId" = v_receiver.id,
        "assignedAt" = v_now,
        "assignedById" = v_receiver.id,
        "assignedByName" = v_receiver.name,
        "updatedAt" = v_now
    where id = v_repair.id;

    v_status := 'ACCEPTED';
    v_message := 'Repair #' || v_repair."repairNumber" || ' transfer accepted by ' || v_receiver.name || '.';

    insert into "RepairLog" ("id", "repairId", "status", "message", "createdAt")
    values (gen_random_uuid(), v_repair.id, 'TRANSFER_ACCEPTED', v_message, v_now);
  else
    v_status := 'REJECTED';
    v_message := 'Repair #' || v_repair."repairNumber" || ' transfer rejected by ' || v_receiver.name || '.';

    insert into "RepairLog" ("id", "repairId", "status", "message", "createdAt")
    values (gen_random_uuid(), v_repair.id, 'TRANSFER_REJECTED', v_message, v_now);
  end if;

  update "RepairTransferRequest"
  set "status" = v_status,
      "respondedAt" = v_now,
      "responseNote" = nullif(trim(coalesce(p_response_note, '')), ''),
      "updatedAt" = v_now
  where id = v_request.id;

  insert into "Notification" (
    "id", "userId", "title", "message", "type", "repairId", "repairNumber",
    "senderId", "senderName", "metadata", "isRead", "createdAt"
  ) values (
    gen_random_uuid(),
    v_request."senderTechnicianId",
    case when v_action = 'ACCEPT' then 'Repair Transfer Accepted' else 'Repair Transfer Rejected' end,
    v_message,
    case when v_action = 'ACCEPT' then 'TRANSFER_ACCEPTED' else 'TRANSFER_REJECTED' end,
    v_repair.id,
    v_repair."repairNumber",
    v_receiver.id,
    v_receiver.name,
    jsonb_build_object('transferRequestId', v_request.id, 'repairId', v_repair.id, 'status', v_status)::text,
    false,
    v_now
  );

  insert into "AuditLog" (
    "id", "userId", "userEmail", "userName", "userRole", "action", "resource", "resourceId", "status", "details", "createdAt"
  ) values (
    gen_random_uuid(), v_receiver.id, v_receiver.email, v_receiver.name, v_receiver.role,
    case when v_action = 'ACCEPT' then 'REPAIR_TRANSFER_ACCEPTED' else 'REPAIR_TRANSFER_REJECTED' end,
    'RepairTransferRequest', v_request.id, 'SUCCESS',
    jsonb_build_object('repairId', v_repair.id, 'repairNumber', v_repair."repairNumber", 'senderTechnicianId', v_request."senderTechnicianId")::text,
    v_now
  );

  return jsonb_build_object(
    'id', v_request.id,
    'repairId', v_repair.id,
    'repairNumber', v_repair."repairNumber",
    'status', v_status,
    'receiverTechnicianId', v_receiver.id,
    'receiverTechnicianName', v_receiver.name,
    'respondedAt', v_now
  );
end;
$$;

create or replace function public.cancel_repair_transfer_request(
  p_request_id uuid,
  p_sender_technician_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request "RepairTransferRequest"%rowtype;
  v_now timestamptz := now();
begin
  select * into v_request
  from "RepairTransferRequest"
  where id = p_request_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'Transfer request not found.';
  end if;

  if v_request."senderTechnicianId" <> p_sender_technician_id then
    raise exception using errcode = 'P0001', message = 'You are not authorized to cancel this transfer request.';
  end if;

  if v_request.status <> 'PENDING' then
    raise exception using errcode = '23505', message = 'Only pending transfer requests can be cancelled.';
  end if;

  update "RepairTransferRequest"
  set "status" = 'CANCELLED', "respondedAt" = v_now, "updatedAt" = v_now
  where id = v_request.id;

  insert into "AuditLog" ("id", "userId", "action", "resource", "resourceId", "status", "details", "createdAt")
  values (
    gen_random_uuid(), p_sender_technician_id, 'REPAIR_TRANSFER_CANCELLED', 'RepairTransferRequest', v_request.id, 'SUCCESS',
    jsonb_build_object('repairId', v_request."repairId", 'repairNumber', v_request."repairNumber")::text, v_now
  );

  return jsonb_build_object('id', v_request.id, 'status', 'CANCELLED');
end;
$$;

revoke all on function public.create_repair_transfer_request(uuid, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.respond_repair_transfer_request(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.cancel_repair_transfer_request(uuid, uuid) from public, anon, authenticated;
grant execute on function public.create_repair_transfer_request(uuid, uuid, text, uuid) to service_role;
grant execute on function public.respond_repair_transfer_request(uuid, uuid, text, text) to service_role;
grant execute on function public.cancel_repair_transfer_request(uuid, uuid) to service_role;
