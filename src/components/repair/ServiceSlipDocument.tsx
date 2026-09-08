import React from 'react';
import { ServiceSlipData, NEPALI_TERMS_AND_CONDITIONS } from '@/services/serviceSlipService';
import { format } from 'date-fns';

interface ServiceSlipDocumentProps {
  data: ServiceSlipData;
  id?: string;
}

export const ServiceSlipDocument: React.FC<ServiceSlipDocumentProps> = ({ data, id }) => {
  const { customer, devices, registrationDate, billIndex, totalBills } = data;

  // Format Registration Date safely
  let formattedDate = '';
  try {
    const dateObj = registrationDate ? new Date(registrationDate) : new Date();
    formattedDate = !isNaN(dateObj.getTime()) ? format(dateObj, 'dd/MM/yyyy') : format(new Date(), 'dd/MM/yyyy');
  } catch {
    formattedDate = format(new Date(), 'dd/MM/yyyy');
  }

  // Multi-Device Formatting
  const isMultiDevice = devices.length > 1;

  // Repair Numbers
  const repairNumbers = devices.map(d => d.repairNumber).filter(Boolean).join(', ');

  // Models
  const modelText = isMultiDevice
    ? devices.map((d, i) => `${i + 1}) ${d.deviceBrand ? `${d.deviceBrand.toUpperCase()} ` : ''}${d.deviceModel}`).join('  |  ')
    : `${devices[0]?.deviceBrand ? `${devices[0].deviceBrand.toUpperCase()} ` : ''}${devices[0]?.deviceModel || '-'}`;

  // IMEIs
  const imeiList = devices.map((d, i) => {
    if (!d.imeiNumber) return isMultiDevice ? `${i + 1}) -` : '';
    return isMultiDevice ? `${i + 1}) ${d.imeiNumber}` : d.imeiNumber;
  }).filter(Boolean);
  const imeiText = imeiList.length > 0 ? imeiList.join('  |  ') : '-';

  // Estimated Cost Calculation
  const hasSpecifiedCost = devices.some(d => {
    if (d.estimatedCost === null || d.estimatedCost === undefined || d.estimatedCost === '') return false;
    const num = Number(d.estimatedCost);
    return !isNaN(num) && num > 0;
  });

  const totalCost = hasSpecifiedCost
    ? devices.reduce((sum, d) => {
        const val = Number(d.estimatedCost);
        return !isNaN(val) && val > 0 ? sum + val : sum;
      }, 0)
    : null;

  const estimatedChargeText = totalCost !== null && totalCost > 0
    ? `Rs. ${totalCost.toLocaleString()}${isMultiDevice ? ` (${devices.length} Devices)` : ''}`
    : '____________________';

  return (
    <div
      id={id}
      className="service-slip-root"
      style={{
        width: '794px',
        height: '520px',
        minWidth: '794px',
        minHeight: '520px',
        maxWidth: '794px',
        maxHeight: '520px',
        padding: '12px 18px 10px 18px',
        border: '1.5px solid #000000',
        boxSizing: 'border-box',
        backgroundColor: '#ffffff',
        color: '#000000',
        fontFamily: '"Segoe UI", "Nirmala UI", "Mangal", "Tiro Devanagari Hindi", -apple-system, BlinkMacSystemFont, Roboto, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      {/* ========================================================================= */}
      {/* 1. TOP HEADER: Mobile Technology Station (MTS Lab) & Centered Black Badge */}
      {/* ========================================================================= */}
      <div style={{ textAlign: 'center', marginBottom: '3px' }}>
        {/* Company Name */}
        <h1 style={{
          fontSize: '20px',
          fontWeight: 900,
          color: '#000000',
          margin: '0 0 2px 0',
          lineHeight: 1.2,
          letterSpacing: '-0.2px'
        }}>
          Mobile Technology Station (MTS Lab)
        </h1>

        {/* Location & Contact Information */}
        <p style={{
          fontSize: '11px',
          fontWeight: 600,
          color: '#334155',
          margin: '0 0 4px 0',
          lineHeight: 1.3
        }}>
          Pako Sadak, New Road, Kathmandu, Nepal &nbsp;|&nbsp; Phone: 9869276668 / 9709797526 / 01-5364307
        </p>

        {/* Dedicated Centered Black Background Rectangle Badge (Perfect Vertical & Horizontal Centering) */}
        <div style={{ marginTop: '3px', marginBottom: '5px', textAlign: 'center' }}>
          <span style={{
            backgroundColor: '#000000',
            color: '#ffffff',
            fontWeight: 900,
            fontSize: '11px',
            height: '24px',
            lineHeight: '24px',
            padding: '0 22px',
            borderRadius: '6px',
            letterSpacing: '1.2px',
            textTransform: 'uppercase',
            display: 'inline-block',
            textAlign: 'center',
            verticalAlign: 'middle',
            boxSizing: 'border-box'
          }}>
            SERVICE SLIP
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. METADATA BAR: R.No., Bill Badge & Date (Clean Corporate Divider) */}
      {/* ========================================================================= */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTop: '1px solid #cbd5e1',
        borderBottom: '1px solid #cbd5e1',
        padding: '3.5px 8px',
        marginBottom: '6px',
        backgroundColor: '#f8fafc',
        borderRadius: '4px'
      }}>
        {/* Left: Receipt / R.No */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>R.No:</span>
          <span style={{ fontSize: '12px', fontWeight: 900, color: '#000000', letterSpacing: '0.2px' }}>{repairNumbers}</span>
          {totalBills > 1 && (
            <span style={{
              fontSize: '9px',
              fontWeight: 800,
              textTransform: 'uppercase',
              backgroundColor: '#e2e8f0',
              color: '#000000',
              padding: '1px 5px',
              borderRadius: '3px',
              border: '1px solid #cbd5e1'
            }}>
              Bill {billIndex}/{totalBills}
            </span>
          )}
        </div>

        {/* Right: Date */}
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>
          Date: <strong style={{ color: '#000000', fontWeight: 900 }}>{formattedDate}</strong>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. MAIN BODY: 2 Columns (Left: Details, Right: Nepali Terms) */}
      {/* ========================================================================= */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.24fr 1fr',
        gap: '12px',
        alignItems: 'stretch',
        flex: 1,
        minHeight: 0
      }}>
        
        {/* ========================================================================= */}
        {/* LEFT COLUMN: Customer Info Grid, Problem Box, Financials & Signatures */}
        {/* ========================================================================= */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          height: '100%'
        }}>
          
          {/* Structured Key-Value Metadata Grid (High Contrast & Clear Readability) */}
          <div style={{
            border: '1px solid #cbd5e1',
            borderRadius: '5px',
            backgroundColor: '#ffffff',
            overflow: 'hidden'
          }}>
            {/* Customer Name Row */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '3px 8px',
              borderBottom: '1px solid #e2e8f0',
              fontSize: '11px',
              backgroundColor: '#ffffff'
            }}>
              <span style={{ color: '#334155', fontWeight: 700, flexShrink: 0, minWidth: '95px' }}>Customer Name:</span>
              <strong style={{ color: '#000000', fontWeight: 900, flex: 1, fontSize: '11.5px', letterSpacing: '0.1px' }}>
                {customer.name || '-'}
              </strong>
            </div>

            {/* Mob. No & IMEI No 2-Column Row */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1.1fr 1fr',
              borderBottom: '1px solid #e2e8f0',
              fontSize: '10.5px',
              backgroundColor: '#ffffff'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '3px 8px',
                borderRight: '1px solid #e2e8f0'
              }}>
                <span style={{ color: '#334155', fontWeight: 700, flexShrink: 0 }}>Mob. No.:</span>
                <strong style={{ color: '#000000', fontWeight: 900, fontSize: '11px' }}>{customer.phone || '-'}</strong>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '3px 8px'
              }}>
                <span style={{ color: '#334155', fontWeight: 700, flexShrink: 0 }}>IMEI No.:</span>
                <strong style={{ color: '#000000', fontWeight: 900, fontFamily: 'monospace', fontSize: '10px' }}>{imeiText}</strong>
              </div>
            </div>

            {/* Model No Row */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '3px 8px',
              fontSize: '11px',
              backgroundColor: '#ffffff'
            }}>
              <span style={{ color: '#334155', fontWeight: 700, flexShrink: 0, minWidth: '95px' }}>Model No.:</span>
              <strong style={{ color: '#000000', fontWeight: 900, flex: 1, fontSize: '11px' }}>
                {modelText}
              </strong>
            </div>

            {/* Courier Receiving Row (When Received Via Courier) */}
            {devices[0]?.receivingMethod === 'COURIER' && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '2px 8px',
                borderTop: '1px solid #e2e8f0',
                fontSize: '9px',
                backgroundColor: '#f8fafc',
                color: '#0f172a'
              }}>
                <span style={{ color: '#0284c7', fontWeight: 800 }}>📦 Courier:</span>
                <span style={{ fontWeight: 700 }}>{devices[0].courierCompany || 'Courier Service'}</span>
                {devices[0].courierTrackingNumber && (
                  <span style={{ color: '#64748b' }}>• Tracking: <strong style={{ color: '#0f172a' }}>{devices[0].courierTrackingNumber}</strong></span>
                )}
              </div>
            )}
          </div>

          {/* Problem Box (Medium Proportional Size: 105px) */}
          <div style={{
            border: '1px solid #cbd5e1',
            backgroundColor: '#f8fafc',
            borderRadius: '5px',
            padding: '5px 8px',
            marginTop: '3px',
            marginBottom: '3px',
            height: '105px',
            minHeight: '105px',
            maxHeight: '105px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            boxSizing: 'border-box'
          }}>
            <div style={{
              fontSize: '10px',
              fontWeight: 800,
              color: '#334155',
              marginBottom: '2px',
              textTransform: 'uppercase',
              letterSpacing: '0.4px',
              borderBottom: '1px solid #e2e8f0',
              paddingBottom: '1.5px'
            }}>
              Problem:
            </div>
            
            <div style={{ fontSize: '10px', fontWeight: 500, lineHeight: 1.32, color: '#000000', flex: 1, overflow: 'hidden', paddingTop: '1px' }}>
              {isMultiDevice ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {devices.map((d, idx) => (
                    <div key={idx} style={{ borderBottom: '1px dashed #e2e8f0', paddingBottom: '1.5px' }}>
                      <strong style={{ color: '#000000', fontWeight: 800 }}>Device {idx + 1} ({d.deviceModel}):</strong>{' '}
                      <span>{d.problemDescription}</span>
                      {d.deviceCondition && d.deviceCondition !== 'Fair' && (
                        <span style={{ color: '#475569', fontStyle: 'italic', marginLeft: '4px' }}>[{d.deviceCondition}]</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5px' }}>
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontWeight: 600, color: '#000000' }}>{devices[0]?.problemDescription || 'Inspection & Diagnostics'}</p>
                  {devices[0]?.deviceCondition && (
                    <p style={{ margin: '1.5px 0 0 0', fontSize: '9.5px', color: '#334155' }}>
                      <strong style={{ color: '#000000' }}>Condition:</strong> {devices[0].deviceCondition}
                    </p>
                  )}
                  {devices[0]?.accessoriesReceived && (
                    <p style={{ margin: '1px 0 0 0', fontSize: '9.5px', color: '#334155' }}>
                      <strong style={{ color: '#000000' }}>Accessories:</strong> {devices[0].accessoriesReceived}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Estimated Service Charge */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#f1f5f9',
            border: '1px solid #cbd5e1',
            borderRadius: '4px',
            padding: '3px 8px',
            fontSize: '10.5px'
          }}>
            <span style={{ fontWeight: 700, color: '#334155' }}>Estimated Service Charge:</span>
            <strong style={{ fontSize: '11.5px', fontWeight: 900, color: '#000000' }}>
              {estimatedChargeText}
            </strong>
          </div>

          {/* Signature Blocks (Aligned Exactly on Bottom Baseline) */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            paddingTop: '5px',
            paddingRight: '4px',
            marginTop: 'auto'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ borderBottom: '1px solid #64748b', width: '115px', marginBottom: '3px' }}></div>
              <span style={{ fontSize: '9.5px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                Authorized Sign
              </span>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ borderBottom: '1px solid #64748b', width: '115px', marginBottom: '3px' }}></div>
              <span style={{ fontSize: '9.5px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                Customer Sign
              </span>
            </div>
          </div>

        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: Exact 9 Nepali Terms & Conditions */}
        {/* ========================================================================= */}
        <div style={{
          borderLeft: '1px solid #cbd5e1',
          paddingLeft: '10px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          height: '100%'
        }}>
          <div style={{
            fontWeight: 900,
            fontSize: '11px',
            color: '#000000',
            marginBottom: '3px',
            borderBottom: '1px solid #e2e8f0',
            paddingBottom: '2px',
            lineHeight: 1
          }}>
            शर्त तथा नियमहरू:
          </div>

          <ul style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            flex: 1,
            textAlign: 'justify'
          }}>
            {NEPALI_TERMS_AND_CONDITIONS.map((term, index) => (
              <li key={index} style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '3.5px',
                fontSize: '8.5px',
                lineHeight: 1.32,
                fontWeight: 500,
                color: '#0f172a',
                paddingBottom: '1px',
                wordBreak: 'normal',
                overflowWrap: 'break-word'
              }}>
                <span style={{ fontSize: '9.5px', lineHeight: 1.2, flexShrink: 0, fontWeight: 900, color: '#0284c7', marginTop: '0.5px' }}>•</span>
                <span style={{ lineHeight: 1.32 }}>{term}</span>
              </li>
            ))}
          </ul>
        </div>

      </div>
    </div>
  );
};

export default ServiceSlipDocument;
