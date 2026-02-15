# Run Backfill Via API Endpoint

Since local npm is having issues, I've created a temporary API endpoint to run the backfill from production.

## How to Run

1. **Deploy to production first** (the endpoint is now in the codebase)

2. **Call the API endpoint**:
   ```bash
   curl -X POST https://your-production-url.vercel.app/api/admin/backfill-scheduling \
     -H "Authorization: Bearer temp-secret-change-me"
   ```

   Or use any HTTP client (Postman, browser console, etc.)

3. **The endpoint will**:
   - Process all orders missing canonical fields
   - Show progress in server logs
   - Return a summary when complete

## Response Format

```json
{
  "success": true,
  "message": "Backfill complete!",
  "summary": {
    "totalProcessed": 1234,
    "updated": 1234,
    "needsReview": 45,
    "errors": 0
  }
}
```

## Security Note

⚠️ **Change the secret!** The current secret is `temp-secret-change-me`. 

To change it:
1. Add to your `.env` or Vercel environment variables: `ADMIN_SECRET=your-secret-here`
2. Update the endpoint to use: `process.env.ADMIN_SECRET`

Or you can remove this endpoint entirely after the backfill is complete.

## Alternative: Run from Vercel CLI

You can also trigger it from Vercel Functions logs or create a one-time script.
