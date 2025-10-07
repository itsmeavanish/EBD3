const Tesseract = require('tesseract.js');
const { Order } = require('../models/Order');
const fs = require('fs');
const path = require('path');

const verifyScreenshot = async (req, res) => {
  try {
    // Validate required inputs
    if (!req.files || !req.files.screenshot) {
      return res.status(400).json({
        success: false,
        message: "Screenshot is required"
      });
    }

    const screenshot = req.files.screenshot;
    const orderNumber = req.body.orderId; // ✅ Expecting orderNumber instead of orderId
    const refundAmount = parseFloat(req.body.refundAmount);

    if (!orderNumber || isNaN(refundAmount)) {
      return res.status(400).json({
        success: false,
        message: "Order number and valid refund amount are required"
      });
    }

    // Check order in database
    const order = await Order.findOne({ orderId:orderNumber });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found in database"
      });
    }

    // Save screenshot temporarily
    const tempDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const tempFilePath = path.join(tempDir, `${Date.now()}-${screenshot.name}`);
    await screenshot.mv(tempFilePath);

    // OCR processing
    const { data: { text } } = await Tesseract.recognize(tempFilePath, 'eng', {
      logger: m => console.log(m)
    });

    // Delete temp file after OCR
    fs.unlinkSync(tempFilePath);

    // ✅ Regex to extract "Order Number" and "Price"
    const orderNumberPattern = /(?:order\s*(?:number|no\.?|#)?[:;\s]*)?([A-Z0-9\-]{6,})/gi;
    const pricePattern = /(?:₹|rs\.?|inr|price|amount|total)[\s:]*([0-9,]+\.?[0-9]*)/gi;

    let extractedOrderNumber = null;
    let extractedPrice = null;

    // Extract order number
    for (const match of [...text.matchAll(orderNumberPattern)]) {
      if (match[1] && match[1].length >= 6) {
        extractedOrderNumber = match[1].toUpperCase();
        if (extractedOrderNumber === orderNumber.toUpperCase()) break;
      }
    }

    // Extract price
    const priceMatches = [...text.matchAll(pricePattern)];
    if (priceMatches.length > 0) {
      const priceString = priceMatches[priceMatches.length - 1][1].replace(/,/g, '');
      extractedPrice = parseFloat(priceString);
    }

    // Verification checks
    const orderMatch = extractedOrderNumber && extractedOrderNumber.toUpperCase() === orderNumber.toUpperCase();
    const priceMatch = extractedPrice && Math.abs(extractedPrice - refundAmount) < 1;

    if (orderMatch && priceMatch) {
      return res.json({
        success: true,
        verified: true,
        message: "Screenshot verified successfully",
        extractedData: { orderNumber: extractedOrderNumber, price: extractedPrice }
      });
    } else {
      return res.status(400).json({
        success: false,
        verified: false,
        message: `Verification failed: ${!orderMatch ? 'Order Number mismatch' : 'Price mismatch'}`,
        extractedData: { orderNumber: extractedOrderNumber, price: extractedPrice },
        expected: { orderNumber, price: refundAmount }
      });
    }

  } catch (error) {
    console.error('Error verifying screenshot:', error);
    return res.status(500).json({
      success: false,
      message: "Error processing screenshot",
      error: error.message // ✅ helpful for debugging
    });
  }
};

module.exports = { verifyScreenshot };
