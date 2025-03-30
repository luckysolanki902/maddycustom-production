import { NextResponse } from 'next/server';
import connectToDb from '@/lib/middleware/connectToDb';
import SupportRequest from '@/models/SupportRequest';
import nodemailer from 'nodemailer';

export async function POST(req) {
  try {
    await connectToDb();
    const { requestId, resolved } = await req.json();
    // Set status and who resolved the query based on user feedback
    const status = resolved ? 'resolved' : 'unresolved';
    const resolvedBy = resolved ? 'ai' : 'support team';

    // Update the request status and return the new document
    const updated = await SupportRequest.findByIdAndUpdate(
      requestId,
      { status, resolvedBy },
      { new: true }
    );
    if (!updated) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // If the query is unresolved, build a professional HTML email with the request details
    if (!resolved) {
      // Construct a professional HTML email body using the updated details
      const htmlContent = `
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h2 style="color: #4a90e2;">Support Request Details</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;"><strong>Mobile</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">${updated.mobile}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;"><strong>Email</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">${updated.email || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;"><strong>Category</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">${updated.category}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;"><strong>Subcategory</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">${updated.subcategory}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;"><strong>Issue</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">${updated.issue}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;"><strong>Status</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">${updated.status}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;"><strong>Resolved By</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">${updated.resolvedBy}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;"><strong>Created At</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">${new Date(updated.createdAt).toLocaleString()}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;"><strong>Updated At</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">${new Date(updated.updatedAt).toLocaleString()}</td>
              </tr>
            </table>
            <p>Please review the details above and take the necessary action.</p>
          </body>
        </html>
      `;

      // Create a transporter using Gmail service
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.NODEMAILER_USER,
          pass: process.env.NODEMAILER_PASSWORD,
        },
      });

      const mailOptions = {
        from: process.env.NODEMAILER_USER,
        to: 'sg.gupta2241@gmail.com',
        subject: 'Unresolved Query Alert: Support Request Details',
        html: htmlContent,
      };

      // Sending the email and logging the result
      try {
        await transporter.sendMail(mailOptions);
      } catch (error) {
        console.error(`Error sending email for unresolved query ID: ${requestId}`, error);
      }
    }

    return NextResponse.json({ message: 'Status updated successfully', updated });
  } catch (error) {
    console.error('Error updating query status:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
