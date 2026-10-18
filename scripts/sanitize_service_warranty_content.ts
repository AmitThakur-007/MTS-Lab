/**
 * Safe, controlled migration script to sanitize stored service descriptions
 * in the RepairPrice database table according to the MTS Lab Global Warranty Content Rule.
 * 
 * Preserves all service IDs, pricing, brand/model metadata, images, and timestamps.
 * Clears in-memory and server SEO caches upon completion.
 */

import { supabaseAdmin } from '../api/_server/config/supabase';
import { sanitizeServiceDescription, checkWarrantyEligibility } from '../src/lib/warrantyPolicy';
import { invalidateSeoServicesCache } from '../api/_server/routes/seo';

async function runSanitization() {
  console.log('=== STARTING MTS LAB SERVICE WARRANTY CONTENT SANITIZATION ===\n');

  const { data: services, error } = await supabaseAdmin
    .from('RepairPrice')
    .select('*');

  if (error || !services) {
    console.error('Failed to load RepairPrice records:', error);
    process.exit(1);
  }

  console.log(`Loaded ${services.length} total services from database.`);

  let updatedCount = 0;
  let skippedEligibleCount = 0;

  for (const service of services) {
    const eligibility = checkWarrantyEligibility(service);

    if (eligibility.isEligible) {
      console.log(`ℹ️ [PRESERVED] Eligible Original Battery Service: "${service.serviceName}" (${service.brand} ${service.model}) - Verified Policy: ${eligibility.verifiedDuration}`);
      skippedEligibleCount++;
      continue;
    }

    // Check if description or problem contains warranty references
    const origDesc = service.description || '';
    const origProblem = service.problem || '';
    const origNotes = service.notes || '';

    const sanitizedDesc = sanitizeServiceDescription(service, origDesc);
    const sanitizedProblem = sanitizeServiceDescription(service, origProblem);

    // If notes contains metadata comments like <!--MTS_META:...-->, preserve them
    let sanitizedNotes = origNotes;
    if (origNotes && /warranty/i.test(origNotes)) {
      const metaMatch = origNotes.match(/<!--MTS_META:[\s\S]*?-->/);
      const cleanBase = origNotes.replace(/<!--MTS_META:[\s\S]*?-->/, '').trim();
      const sanitizedBase = sanitizeServiceDescription(service, cleanBase);
      sanitizedNotes = metaMatch ? `${sanitizedBase}\n${metaMatch[0]}` : sanitizedBase;
    }

    const needsUpdate =
      sanitizedDesc !== origDesc ||
      sanitizedProblem !== origProblem ||
      sanitizedNotes !== origNotes;

    if (needsUpdate) {
      console.log(`🧹 [SANITIZING] Non-eligible Service: "${service.serviceName}" (${service.brand} ${service.model}) [Category: ${service.category}]`);
      if (origDesc !== sanitizedDesc) {
        console.log(`   Before: ${origDesc.slice(0, 100)}...`);
        console.log(`   After:  ${sanitizedDesc.slice(0, 100)}...`);
      }

      const { error: updateErr } = await supabaseAdmin
        .from('RepairPrice')
        .update({
          description: sanitizedDesc || null,
          problem: sanitizedProblem || null,
          notes: sanitizedNotes || null,
        })
        .eq('id', service.id);

      if (updateErr) {
        console.error(`   ❌ Failed to update service ${service.id}:`, updateErr);
      } else {
        console.log(`   ✅ Successfully updated service ${service.id}`);
        updatedCount++;
      }
    }
  }

  // Invalidate SEO server cache
  invalidateSeoServicesCache();

  console.log('\n=== SANITIZATION SUMMARY ===');
  console.log(`Total services checked: ${services.length}`);
  console.log(`Eligible original battery services preserved: ${skippedEligibleCount}`);
  console.log(`Non-eligible services sanitized: ${updatedCount}`);
  console.log('SEO cache invalidated successfully.');
}

runSanitization().catch((err) => {
  console.error('Fatal error during sanitization:', err);
  process.exit(1);
});
