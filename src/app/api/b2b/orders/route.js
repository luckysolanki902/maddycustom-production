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

    // Build beautified email HTML summary
    const confirmationUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://www.maddycustom.com'}/b2b/confirmation/${order._id}`;
    const totalQuantity = sanitizedItems.reduce((sum,i)=>sum + (i.quantity||0),0);
    const itemsRows = sanitizedItems.map((i,idx)=>`
      <tr style="background:${idx % 2 ? '#fafafa':'#ffffff'}">
        <td style='padding:10px 12px;border:1px solid #e5e5e5;font-family:Arial,Helvetica,sans-serif;font-size:13px;'>${i.sku}</td>
        <td style='padding:10px 12px;border:1px solid #e5e5e5;font-family:Arial,Helvetica,sans-serif;font-size:13px;'>${i.name}</td>
        <td style='padding:10px 12px;border:1px solid #e5e5e5;font-family:Arial,Helvetica,sans-serif;font-size:13px;text-align:center;font-weight:600;'>${i.quantity}</td>
      </tr>`).join('');
    const html = `<!DOCTYPE html><html><head><meta charset='UTF-8'><title>B2B Bulk Request</title>
      <meta name='color-scheme' content='light only' />
      <style>@media (max-width:600px){.wrapper{padding:16px!important}.heading{font-size:20px!important}.meta-grid td{display:block;width:100%!important;box-sizing:border-box}}</style></head>
      <body style='margin:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;'>
        <table role='presentation' width='100%' cellspacing='0' cellpadding='0' style='background:#f4f6f8;padding:30px 0;'>
          <tr><td>
            <table role='presentation' class='wrapper' cellspacing='0' cellpadding='0' align='center' style='width:100%;max-width:760px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 6px 28px -10px rgba(0,0,0,0.15)'>
              <tr>
                <td style='background:linear-gradient(135deg,#111,#2c2c2c);padding:28px 32px;color:#fff;'>
                  <h1 class='heading' style='margin:0;font-size:24px;letter-spacing:.5px;font-weight:600;'>New B2B Bulk Request</h1>
                  <div style='margin-top:6px;font-size:13px;opacity:.85;'>Request ID: <span style="font-family:monospace;">${order._id}</span></div>
                </td>
              </tr>
              <tr><td style='padding:28px 32px;'>
                <table role='presentation' width='100%' style='border-collapse:collapse;margin:0 0 18px 0;'>
                  <tr>
                    <td style='padding:0 0 10px 0;font-size:14px;line-height:1.5;color:#222;'>Hi Team,<br/>A new bulk request was submitted. Details below:</td>
                  </tr>
                </table>
                <table role='presentation' class='meta-grid' width='100%' style='border-collapse:collapse;margin-bottom:24px;'>
                  <tr>
                    <td style='padding:4px 0;font-size:13px;width:33%;vertical-align:top;'><strong style='color:#111;'>Business:</strong><br/>${businessName}</td>
                    <td style='padding:4px 0;font-size:13px;width:33%;vertical-align:top;'><strong style='color:#111;'>Contact:</strong><br/>${contactName} ${role?`(${role})`:''}</td>
                    <td style='padding:4px 0;font-size:13px;width:34%;vertical-align:top;'><strong style='color:#111;'>Email:</strong><br/><a href='mailto:${contactEmail}' style='color:#0a66c2;text-decoration:none;'>${contactEmail}</a></td>
                  </tr>
                  <tr>
                    <td style='padding:4px 0;font-size:13px;vertical-align:top;'><strong style='color:#111;'>Phone:</strong><br/><a href='tel:${contactPhone}' style='color:#0a66c2;text-decoration:none;'>${contactPhone}</a></td>
                    <td style='padding:4px 0;font-size:13px;vertical-align:top;'><strong style='color:#111;'>Address:</strong><br/>${(address?.line1||'')}${address?.line2?(', '+address.line2):''}, ${(address?.city||'')}, ${(address?.state||'')} ${(address?.pincode||'')} ${(address?.country||'')}</td>
                    <td style='padding:4px 0;font-size:13px;vertical-align:top;'><strong style='color:#111;'>Total Qty:</strong><br/>${totalQuantity}</td>
                  </tr>
                  ${notes ? `<tr><td colspan='3' style='padding:10px 0;font-size:13px;'><strong style='color:#111;'>Notes:</strong><br/>${notes.replace(/</g,'&lt;')}</td></tr>`:''}
                </table>
                <table width='100%' cellspacing='0' cellpadding='0' style='border-collapse:separate;border-spacing:0;width:100%;margin-bottom:26px;'>
                  <thead>
                    <tr style='background:#111;color:#fff;'>
                      <th align='left' style='padding:12px;border:1px solid #111;font-size:12px;letter-spacing:.5px;text-transform:uppercase;'>SKU</th>
                      <th align='left' style='padding:12px;border:1px solid #111;font-size:12px;letter-spacing:.5px;text-transform:uppercase;'>Name</th>
                      <th align='center' style='padding:12px;border:1px solid #111;font-size:12px;letter-spacing:.5px;text-transform:uppercase;'>Qty</th>
                    </tr>
                  </thead>
                  <tbody>${itemsRows}</tbody>
                  <tfoot>
                    <tr>
                      <td colspan='2' style='padding:12px 12px 14px;border:1px solid #e5e5e5;background:#f9fafb;font-size:13px;font-weight:600;text-align:right;'>Total</td>
                      <td style='padding:12px 12px 14px;border:1px solid #e5e5e5;background:#f9fafb;font-size:13px;font-weight:700;text-align:center;'>${totalQuantity}</td>
                    </tr>
                  </tfoot>
                </table>
                <div style='text-align:center;margin-bottom:10px;'>
                  <a href='${confirmationUrl}' style='display:inline-block;background:#111;color:#fff;text-decoration:none;padding:14px 28px;border-radius:50px;font-size:13px;font-weight:600;letter-spacing:.5px;box-shadow:0 4px 14px -4px rgba(0,0,0,0.4)'>View Request / Respond</a>
                </div>
                <div style='font-size:11px;color:#666;text-align:center;line-height:1.4;'>You are receiving this email because your address is set to receive B2B notifications.<br/>© ${new Date().getFullYear()} MaddyCustom</div>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </body></html>`;

    try {
      const params = {
        Source: process.env.SES_FROM_EMAIL || 'contact@maddycustom.com',
        Destination: { ToAddresses: [process.env.B2B_NOTIF_EMAIL || 'contact@maddycustom.com'], CcAddresses: [contactEmail] },
        Message: {
          Subject: { Data: `B2B Bulk Request #${order._id}` },
          Body: { Html: { Data: html } }
        }
      };
      const command = new SendEmailCommand(params);
      await sesClient.send(command);
    } catch (e) {
      console.error('Failed sending SES email for B2B order', e);
      // Fallback to Nodemailer Gmail if available
      if (process.env.NODEMAILER_USER && process.env.NODEMAILER_PASSWORD) {
        try {
          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: process.env.NODEMAILER_USER,
              pass: process.env.NODEMAILER_PASSWORD
            }
          });
          await transporter.sendMail({
            from: process.env.NODEMAILER_USER,
            to: process.env.B2B_NOTIF_EMAIL || process.env.NODEMAILER_USER,
            cc: contactEmail,
            subject: `B2B Bulk Request #${order._id}`,
            html
          });
        } catch (gErr) {
          console.error('Fallback Gmail send failed', gErr);
        }
      }
    }

    return NextResponse.json({ orderId: order._id });
  } catch (e) {
    console.error('B2B create error', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
