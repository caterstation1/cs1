# WLG 2-Day Outlook Email - Setup Guide

## Overview
Automated daily email sent at 9:00 AM showing Wellington orders for the next 2 days.

## Features
- **Automated Daily Email**: Runs automatically at 9am every day via Vercel Cron
- **2-Day Outlook**: Shows orders for tomorrow and day after tomorrow
- **WLG Filtered**: Only includes Wellington orders (filtered by city attribute, line item properties, or shipping address)
- **Well-Formatted**: Clean HTML email with order details organized by date
- **No Orders Handling**: Shows "No orders" message if no orders exist for a day

## Email Content Structure

Each order includes:
- Order number
- Delivery time  
- Company name
- Customer name
- Delivery address (line 1 and 2)
- Phone number
- **Product items** (with display names and variant information)
- **Add-on items** (separately listed)
- Order notes (if any)

## Setup Instructions

### 1. Configure Environment Variables

Add these to your Vercel project environment variables:

```bash
# Email configuration (if not already set)
EMAIL_USER="your-email@gmail.com"
EMAIL_APP_PASSWORD="your-gmail-app-password"

# WLG Outlook specific
WLG_OUTLOOK_EMAIL="recipient@example.com"  # Who receives the daily outlook
CRON_SECRET="your-secret-key-here"         # Secret for authorizing cron requests
```

**To set in Vercel:**
1. Go to your project dashboard on Vercel
2. Settings → Environment Variables
3. Add `WLG_OUTLOOK_EMAIL` with the recipient email address
4. Add `CRON_SECRET` with a secure random string (e.g., generated via `openssl rand -base64 32`)

### 2. Deploy to Vercel

The cron job is configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/wlg-outlook",
      "schedule": "0 9 * * *"
    }
  ]
}
```

**Schedule:** `0 9 * * *` = Every day at 9:00 AM (UTC)

⚠️ **Note:** Vercel cron jobs run in UTC timezone. If you want 9am NZST (UTC+12), set to `21 * * *` (9pm UTC previous day). For 9am NZDT (UTC+13), use `20 * * *`.

### 3. Verify Cron Setup

After deployment:

1. Go to Vercel Dashboard → Your Project → Settings → Crons
2. You should see the `wlg-outlook` cron listed
3. Check it runs daily at the scheduled time

### 4. Test the Email Manually

To test without waiting for 9am, you can trigger it manually via API call:

```bash
curl -X GET https://your-app.vercel.app/api/cron/wlg-outlook \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Replace:
- `your-app.vercel.app` with your actual Vercel URL
- `YOUR_CRON_SECRET` with your actual `CRON_SECRET` value

## Email Example

**Subject:** `WLG 2-Day Outlook - Jan 15 & Jan 16`

```
┌─────────────────────────────────┐
│  🗓️ WLG 2-Day Outlook           │
│  Wellington Orders - Next 2 Days │
└─────────────────────────────────┘

📅 Tuesday, January 15, 2025
┌──────────────────────────────────
│ Order #10500          11:30 AM
│ Company: ABC Corp
│ Customer: John Smith
│ Address: 123 Willis Street
│          Wellington Central
│ Phone: 021 123 4567
│
│ PRODUCTS
│ 2x Thai Chicken Salad (Beef, Yes Serveware)
│ 1x Vegetarian Bowl
│
│ ADD-ONS
│ 3x Extra Dressing
│
│ 📝 Order Notes
│ Please leave at reception
└──────────────────────────────────

📅 Wednesday, January 16, 2025
No orders
```

## Troubleshooting

### Email Not Sending
1. Check `EMAIL_USER` and `EMAIL_APP_PASSWORD` are set correctly
2. Verify Gmail App Password (not regular password) is being used
3. Check Vercel logs for error messages

### Cron Not Running
1. Verify the cron is visible in Vercel Dashboard → Settings → Crons
2. Check `vercel.json` is committed and deployed
3. Cron jobs require a Vercel Pro plan or higher

### Wrong Orders Showing
- Orders are filtered by:
  1. `note_attributes` City = "WLG"
  2. Line item `properties` City = "WLG"  
  3. Shipping address city/province containing "Wellington" or province code "WGN"
- Check orders have correct city metadata

### Wrong Timezone
- Vercel crons run in UTC
- To get 9am NZST/NZDT, adjust the cron schedule:
  - NZST (UTC+12): use `21 * * *` for 9am next day
  - NZDT (UTC+13): use `20 * * *` for 9am next day

## Files Modified/Created

- `src/lib/email-formatter.ts` - Email HTML template generator
- `src/app/api/cron/wlg-outlook/route.ts` - API endpoint that sends the email
- `vercel.json` - Cron configuration
- `env.template` - Added new environment variables

## Customization

### Change Email Time
Edit `vercel.json` cron schedule:
```json
{
  "schedule": "0 9 * * *"  // 9am UTC
}
```

### Change Recipient
Update `WLG_OUTLOOK_EMAIL` environment variable

### Customize Email Template
Edit `src/lib/email-formatter.ts` to modify:
- Colors and styling
- Layout and structure
- Content and sections

### Add More Recipients
Modify the email sending code in `src/app/api/cron/wlg-outlook/route.ts`:
```typescript
await transporter.sendMail({
  from: process.env.EMAIL_USER,
  to: 'email1@example.com, email2@example.com',  // Multiple recipients
  subject: `...`,
  html: emailHTML,
})
```

## Support

If you need help, check:
1. Vercel logs for error messages
2. Email service logs (Gmail sent items)
3. Test the endpoint manually with curl

