interface OrderEmailData {
  orderNumber: number
  deliveryTime: string
  companyName: string
  customerName: string
  address1: string
  address2?: string
  phone: string
  productItems: Array<{
    displayName: string
    quantity: number
    variantInfo?: string
  }>
  addonItems: Array<{
    name: string
    quantity: number
  }>
  orderNotes?: string
}

export function formatWLGOutlookEmail(
  todayOrders: OrderEmailData[],
  tomorrowOrders: OrderEmailData[],
  dayAfterOrders: OrderEmailData[],
  todayDate: string,
  tomorrowDate: string,
  dayAfterDate: string
): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WLG 2-Day Outlook</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .email-container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%);
      color: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
    }
    .header p {
      margin: 5px 0 0 0;
      opacity: 0.9;
      font-size: 14px;
    }
    .date-section {
      margin-bottom: 40px;
    }
    .date-header {
      background-color: #f0f9ff;
      border-left: 4px solid #0284c7;
      padding: 12px 16px;
      margin-bottom: 20px;
      border-radius: 4px;
    }
    .date-header h2 {
      margin: 0;
      color: #0284c7;
      font-size: 20px;
    }
    .no-orders {
      color: #6b7280;
      font-style: italic;
      padding: 20px;
      text-align: center;
      background-color: #f9fafb;
      border-radius: 4px;
    }
    .order-card {
      background-color: #fafafa;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 20px;
      margin-bottom: 20px;
    }
    .order-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
      padding-bottom: 15px;
      border-bottom: 2px solid #e5e7eb;
    }
    .order-number {
      font-size: 18px;
      font-weight: bold;
      color: #0284c7;
    }
    .delivery-time {
      font-size: 16px;
      color: #dc2626;
      font-weight: 600;
    }
    .customer-info {
      margin-bottom: 15px;
      line-height: 1.8;
    }
    .customer-info strong {
      color: #374151;
      display: inline-block;
      min-width: 120px;
    }
    .items-section {
      margin: 15px 0;
    }
    .items-header {
      font-weight: bold;
      color: #374151;
      margin-bottom: 8px;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .item {
      padding: 6px 0;
      padding-left: 20px;
      border-left: 2px solid #e5e7eb;
      margin-bottom: 4px;
    }
    .item-name {
      font-weight: 500;
      color: #1f2937;
    }
    .item-variant {
      color: #6b7280;
      font-size: 14px;
      margin-left: 8px;
    }
    .quantity {
      color: #0284c7;
      font-weight: 600;
      margin-right: 8px;
    }
    .notes {
      background-color: #fffbeb;
      border-left: 3px solid #f59e0b;
      padding: 12px;
      margin-top: 15px;
      border-radius: 4px;
    }
    .notes-header {
      font-weight: bold;
      color: #92400e;
      margin-bottom: 5px;
    }
    .notes-text {
      color: #78350f;
      font-size: 14px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #6b7280;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <h1>🗓️ WLG 3-Day Outlook</h1>
      <p>Wellington Orders - Today & Next 2 Days</p>
    </div>

    <!-- Today's Orders -->
    <div class="date-section">
      <div class="date-header">
        <h2>📅 ${todayDate} (Today)</h2>
      </div>
      ${
        todayOrders.length === 0
          ? '<div class="no-orders">No orders</div>'
          : todayOrders.map(order => generateOrderHTML(order)).join('')
      }
    </div>

    <!-- Tomorrow's Orders -->
    <div class="date-section">
      <div class="date-header">
        <h2>📅 ${tomorrowDate} (Tomorrow)</h2>
      </div>
      ${
        tomorrowOrders.length === 0
          ? '<div class="no-orders">No orders</div>'
          : tomorrowOrders.map(order => generateOrderHTML(order)).join('')
      }
    </div>

    <!-- Day After Tomorrow's Orders -->
    <div class="date-section">
      <div class="date-header">
        <h2>📅 ${dayAfterDate}</h2>
      </div>
      ${
        dayAfterOrders.length === 0
          ? '<div class="no-orders">No orders</div>'
          : dayAfterOrders.map(order => generateOrderHTML(order)).join('')
      }
    </div>

    <div class="footer">
      <p>This is an automated email sent daily at 9:00 AM</p>
      <p>CaterStation © ${new Date().getFullYear()}</p>
    </div>
  </div>
</body>
</html>
  `.trim()
}

function generateOrderHTML(order: OrderEmailData): string {
  return `
    <div class="order-card">
      <div class="order-header">
        <div class="order-number">Order #${order.orderNumber}</div>
        <div class="delivery-time">${order.deliveryTime || 'Time TBC'}</div>
      </div>
      
      <div class="customer-info">
        <div><strong>Company:</strong> ${order.companyName || 'N/A'}</div>
        <div><strong>Customer:</strong> ${order.customerName}</div>
        <div><strong>Address:</strong> ${order.address1}</div>
        ${order.address2 ? `<div style="padding-left: 120px;">${order.address2}</div>` : ''}
        <div><strong>Phone:</strong> ${order.phone || 'N/A'}</div>
      </div>

      ${
        order.productItems.length > 0
          ? `
        <div class="items-section">
          <div class="items-header">Products</div>
          ${order.productItems
            .map(
              item => `
            <div class="item">
              <span class="quantity">${item.quantity}x</span>
              <span class="item-name">${item.displayName}</span>
              ${item.variantInfo ? `<span class="item-variant">(${item.variantInfo})</span>` : ''}
            </div>
          `
            )
            .join('')}
        </div>
      `
          : ''
      }

      ${
        order.addonItems.length > 0
          ? `
        <div class="items-section">
          <div class="items-header">Add-ons</div>
          ${order.addonItems
            .map(
              item => `
            <div class="item">
              <span class="quantity">${item.quantity}x</span>
              <span class="item-name">${item.name}</span>
            </div>
          `
            )
            .join('')}
        </div>
      `
          : ''
      }

      ${
        order.orderNotes
          ? `
        <div class="notes">
          <div class="notes-header">📝 Order Notes</div>
          <div class="notes-text">${order.orderNotes}</div>
        </div>
      `
          : ''
      }
    </div>
  `
}

