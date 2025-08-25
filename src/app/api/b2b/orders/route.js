import { NextResponse } from 'next/server';
import connectToDb from '@/lib/middleware/connectToDb';
import B2BOrder from '@/models/B2BOrder';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import nodemailer from 'nodemailer';

const sesClient = new SESClient({ region: 'ap-south-1' });

export async function POST(req) {
  try {
    await connectToDb();
    const body = await req.json();
    const { businessName, contactName, contactEmail, contactPhone, role, notes, address, items } = body;

    if (!businessName || !contactName || !contactEmail || !contactPhone || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Sanitize items: remove zero qty and map to schema fields
    const sanitizedItems = (items || [])
      .filter(i => (i.quantity || 0) > 0)
      .map(i => ({
        product: i.productId, // reference id
        option: i.optionId || undefined,
        sku: i.sku,
        name: i.name,
        quantity: i.quantity,
        thumbnail: i.thumbnail,
        wrapFinish: i.wrapFinish
      }));
    if (!sanitizedItems.length) {
      return NextResponse.json({ error: 'No valid items (qty > 0)' }, { status: 400 });
    }

    const order = await B2BOrder.create({ businessName, contactName, contactEmail, contactPhone, role, notes, address, items: sanitizedItems });

    // Build beautified email HTML summaries (separate admin + customer)
    const confirmationUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://www.maddycustom.com'}/b2b/confirmation/${order._id}`;
    const totalQuantity = sanitizedItems.reduce((sum,i)=>sum + (i.quantity||0),0);
    const itemsRows = sanitizedItems.map((i,idx)=>`
      <tr style="background:${idx % 2 ? '#fafafa':'#ffffff'}">
        <td style='padding:10px 12px;border:1px solid #e5e5e5;font-family:Arial,Helvetica,sans-serif;font-size:13px;'>${i.sku}</td>
        <td style='padding:10px 12px;border:1px solid #e5e5e5;font-family:Arial,Helvetica,sans-serif;font-size:13px;'>${i.name}</td>
        <td style='padding:10px 12px;border:1px solid #e5e5e5;font-family:Arial,Helvetica,sans-serif;font-size:13px;text-align:center;font-weight:600;'>${i.quantity}</td>
      </tr>`).join('');

    const commonHead = `<meta charset='UTF-8'><meta name='color-scheme' content='light only'/><meta name='viewport' content='width=device-width,initial-scale=1'/><style>@media (max-width:600px){.wrapper{padding:16px!important}.heading{font-size:20px!important}.meta-grid td{display:block!important;width:100%!important;box-sizing:border-box!important}}</style>`;

    const adminHtml = `<!DOCTYPE html><html><head><title>New B2B Bulk Request</title>${commonHead}</head><body style='margin:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;'>
      <table role='presentation' width='100%' cellspacing='0' cellpadding='0' style='background:#f4f6f8;padding:30px 0;'>
        <tr><td>
          <table role='presentation' class='wrapper' cellspacing='0' cellpadding='0' align='center' style='width:100%;max-width:760px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 6px 28px -10px rgba(0,0,0,0.15)'>
            <tr><td style='background:linear-gradient(135deg,#111,#2c2c2c);padding:26px 30px;color:#fff;'>
              <h1 class='heading' style='margin:0;font-size:24px;letter-spacing:.5px;font-weight:600;'>New B2B Bulk Request</h1>
              <div style='margin-top:6px;font-size:13px;opacity:.85;'>Request ID: <span style="font-family:monospace;">${order._id}</span></div>
            </td></tr>
            <tr><td style='padding:26px 30px;'>
              <p style='margin:0 0 14px 0;font-size:14px;line-height:1.5;color:#222;'>Hi Team,<br/>A new bulk request was submitted. Details below:</p>
              <table class='meta-grid' width='100%' style='border-collapse:collapse;margin-bottom:22px;'>
                <tr>
                  <td style='padding:4px 0;font-size:13px;width:33%;vertical-align:top;'><strong>Business:</strong><br/>${businessName}</td>
                  <td style='padding:4px 0;font-size:13px;width:33%;vertical-align:top;'><strong>Contact:</strong><br/>${contactName} ${role?`(${role})`:''}</td>
                  <td style='padding:4px 0;font-size:13px;width:34%;vertical-align:top;'><strong>Email:</strong><br/><a href='mailto:${contactEmail}' style='color:#0a66c2;text-decoration:none;'>${contactEmail}</a></td>
                </tr>
                <tr>
                  <td style='padding:4px 0;font-size:13px;vertical-align:top;'><strong>Phone:</strong><br/><a href='tel:${contactPhone}' style='color:#0a66c2;text-decoration:none;'>${contactPhone}</a></td>
                  <td style='padding:4px 0;font-size:13px;vertical-align:top;'><strong>Address:</strong><br/>${(address?.line1||'')}${address?.line2?(', '+address.line2):''}, ${(address?.city||'')}, ${(address?.state||'')} ${(address?.pincode||'')} ${(address?.country||'')}</td>
                  <td style='padding:4px 0;font-size:13px;vertical-align:top;'><strong>Total Qty:</strong><br/>${totalQuantity}</td>
                </tr>
                ${notes ? `<tr><td colspan='3' style='padding:10px 0;font-size:13px;'><strong>Notes:</strong><br/>${notes.replace(/</g,'&lt;')}</td></tr>`:''}
              </table>
              <table width='100%' cellspacing='0' cellpadding='0' style='border-collapse:separate;border-spacing:0;width:100%;margin-bottom:24px;'>
                <thead><tr style='background:#111;color:#fff;'>
                  <th align='left' style='padding:12px;border:1px solid #111;font-size:12px;letter-spacing:.5px;text-transform:uppercase;'>SKU</th>
                  <th align='left' style='padding:12px;border:1px solid #111;font-size:12px;letter-spacing:.5px;text-transform:uppercase;'>Name</th>
                  <th align='center' style='padding:12px;border:1px solid #111;font-size:12px;letter-spacing:.5px;text-transform:uppercase;'>Qty</th>
                </tr></thead>
                <tbody>${itemsRows}</tbody>
                <tfoot><tr>
                  <td colspan='2' style='padding:12px;border:1px solid #e5e5e5;background:#f9fafb;font-size:13px;font-weight:600;text-align:right;'>Total</td>
                  <td style='padding:12px;border:1px solid #e5e5e5;background:#f9fafb;font-size:13px;font-weight:700;text-align:center;'>${totalQuantity}</td>
                </tr></tfoot>
              </table>
              <div style='text-align:center;margin-bottom:10px;'>
                <a href='${confirmationUrl}' style='display:inline-block;background:#111;color:#fff;text-decoration:none;padding:14px 28px;border-radius:50px;font-size:13px;font-weight:600;letter-spacing:.5px;box-shadow:0 4px 14px -4px rgba(0,0,0,0.4)'>View Request / Respond</a>
              </div>
              <div style='font-size:11px;color:#666;text-align:center;line-height:1.4;'>Internal notification • © ${new Date().getFullYear()} MaddyCustom</div>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body></html>`;

    const customerHtml = `<!DOCTYPE html><html><head><title>Your Bulk Request Received</title>${commonHead}</head><body style='margin:0;background:#f5f7fa;font-family:Arial,Helvetica,sans-serif;'>
      <table role='presentation' width='100%' cellspacing='0' cellpadding='0' style='background:#f5f7fa;padding:28px 0;'>
        <tr><td>
          <table role='presentation' class='wrapper' cellspacing='0' cellpadding='0' align='center' style='width:100%;max-width:720px;margin:0 auto;background:#ffffff;border-radius:22px;overflow:hidden;box-shadow:0 8px 30px -10px rgba(0,0,0,0.15)'>
            <tr><td style='background:linear-gradient(135deg,#141414,#2d2d2d);padding:30px 34px;color:#fff;'>
              <h1 class='heading' style='margin:0;font-size:24px;font-weight:600;letter-spacing:.4px;'>Thank You – Request Received</h1>
              <div style='margin-top:6px;font-size:13px;opacity:.85;'>Reference ID: <span style='font-family:monospace;'>${order._id}</span></div>
            </td></tr>
            <tr><td style='padding:30px 34px;'>
              <p style='margin:0 0 16px 0;font-size:15px;line-height:1.55;color:#222;'>Hi ${contactName},</p>
              <p style='margin:0 0 18px 0;font-size:14px;line-height:1.6;color:#333;'>We’ve received your bulk purchase inquiry for <strong>${businessName}</strong>. Our team will review your request and get back to you shortly with pricing & next steps. Below is a summary for your records.</p>
              <table width='100%' style='border-collapse:collapse;margin:0 0 22px 0;'>
                <tbody>
                  <tr>
                    <td style='padding:6px 0;font-size:13px;vertical-align:top;width:33%;'><strong>Business</strong><br/>${businessName}</td>
                    <td style='padding:6px 0;font-size:13px;vertical-align:top;width:33%;'><strong>Contact</strong><br/>${contactName}${role?` (${role})`:''}</td>
                    <td style='padding:6px 0;font-size:13px;vertical-align:top;width:34%;'><strong>Phone</strong><br/><a href='tel:${contactPhone}' style='color:#0a66c2;text-decoration:none;'>${contactPhone}</a></td>
                  </tr>
                  <tr>
                    <td style='padding:6px 0;font-size:13px;vertical-align:top;'><strong>Email</strong><br/><a href='mailto:${contactEmail}' style='color:#0a66c2;text-decoration:none;'>${contactEmail}</a></td>
                    <td style='padding:6px 0;font-size:13px;vertical-align:top;'><strong>Total Qty</strong><br/>${totalQuantity}</td>
                    <td style='padding:6px 0;font-size:13px;vertical-align:top;'><strong>Submitted</strong><br/>${new Date(order.createdAt).toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td colspan='3' style='padding:6px 0;font-size:13px;vertical-align:top;'><strong>Address</strong><br/>${(address?.line1||'')}${address?.line2?(', '+address.line2):''}, ${(address?.city||'')}, ${(address?.state||'')} ${(address?.pincode||'')} ${(address?.country||'')}</td>
                  </tr>
                  ${notes ? `<tr><td colspan='3' style='padding:8px 0;font-size:13px;'><strong>Notes</strong><br/>${notes.replace(/</g,'&lt;')}</td></tr>`:''}
                </tbody>
              </table>
              <table width='100%' cellspacing='0' cellpadding='0' style='border-collapse:separate;border-spacing:0;width:100%;margin:0 0 26px 0;'>
                <thead><tr style='background:#141414;color:#fff;'>
                  <th align='left' style='padding:12px;border:1px solid #141414;font-size:12px;letter-spacing:.5px;text-transform:uppercase;'>SKU</th>
                  <th align='left' style='padding:12px;border:1px solid #141414;font-size:12px;letter-spacing:.5px;text-transform:uppercase;'>Name</th>
                  <th align='center' style='padding:12px;border:1px solid #141414;font-size:12px;letter-spacing:.5px;text-transform:uppercase;'>Qty</th>
                </tr></thead>
                <tbody>${itemsRows}</tbody>
                <tfoot><tr>
                  <td colspan='2' style='padding:12px;border:1px solid #e5e5e5;background:#fafbfc;font-size:13px;font-weight:600;text-align:right;'>Total</td>
                  <td style='padding:12px;border:1px solid #e5e5e5;background:#fafbfc;font-size:13px;font-weight:700;text-align:center;'>${totalQuantity}</td>
                </tr></tfoot>
              </table>
              <div style='text-align:center;margin:0 0 18px 0;'>
                <a href='${confirmationUrl}' style='display:inline-block;background:#141414;color:#fff;text-decoration:none;padding:14px 28px;border-radius:50px;font-size:13px;font-weight:600;letter-spacing:.5px;box-shadow:0 4px 16px -4px rgba(0,0,0,0.45)'>View Request Status</a>
              </div>
              <p style='margin:0 0 10px 0;font-size:12px;line-height:1.5;color:#666;'>If any detail seems incorrect, just reply to this email and we’ll update it.</p>
              <div style='font-size:11px;color:#888;text-align:center;line-height:1.5;'>This confirmation is for your records only and not a final invoice.<br/>© ${new Date().getFullYear()} MaddyCustom</div>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body></html>`;

    // Attempt SES first for both emails
    try {
      const sourceEmail = process.env.SES_FROM_EMAIL || 'contact@maddycustom.com';
      // Admin email
      await sesClient.send(new SendEmailCommand({
        Source: sourceEmail,
        Destination: { ToAddresses: [process.env.B2B_NOTIF_EMAIL || 'contact@maddycustom.com'] },
        Message: { Subject: { Data: `B2B Bulk Request #${order._id}` }, Body: { Html: { Data: adminHtml } } }
      }));
      // Customer email
      await sesClient.send(new SendEmailCommand({
        Source: sourceEmail,
        Destination: { ToAddresses: [contactEmail] },
        Message: { Subject: { Data: `We've received your bulk request (#${order._id})` }, Body: { Html: { Data: customerHtml } } }
      }));
    } catch (e) {
      console.error('Failed sending SES emails for B2B order', e);
      if (process.env.NODEMAILER_USER && process.env.NODEMAILER_PASSWORD) {
        try {
          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.NODEMAILER_USER, pass: process.env.NODEMAILER_PASSWORD }
          });
          // Admin
            await transporter.sendMail({
              from: process.env.NODEMAILER_USER,
              to: process.env.B2B_NOTIF_EMAIL || process.env.NODEMAILER_USER,
              subject: `B2B Bulk Request #${order._id}`,
              html: adminHtml
            });
          // Customer
            await transporter.sendMail({
              from: process.env.NODEMAILER_USER,
              to: contactEmail,
              subject: `We've received your bulk request (#${order._id})`,
              html: customerHtml
            });
        } catch (gErr) {
          console.error('Fallback Gmail sends failed', gErr);
        }
      }
    }

    return NextResponse.json({ orderId: order._id });
  } catch (e) {
    console.error('B2B create error', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
