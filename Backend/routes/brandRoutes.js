const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { Order } = require("../models/Order");

router.get("/dashboard/:brandName", authMiddleware, async (req, res) => {
  try {
    const { brandName } = req.params;
    const { startDate, endDate, season, status } = req.query;

    let query = { brandName: brandName };

    if (startDate && endDate) {
      query.submittedAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    if (season && season !== 'all') {
      query.season = season;
    }

    if (status === 'placed') {
      query.isPlaced = true;
    } else if (status === 'alloted') {
      query.isAlloted = true;
    } else if (status === 'confirmed') {
      query.isConfirmed = true;
    }

    const orders = await Order.find(query).sort({ submittedAt: -1 });

    const placedOrders = orders.filter(order => order.isPlaced === true);
    const totalRevenue = placedOrders.reduce((sum, order) => sum + (order.price || 0), 0);
    const totalOrders = placedOrders.length;
    const allotedOrders = orders.filter(o => o.isAlloted).length;
    const confirmedOrders = orders.filter(o => o.isConfirmed).length;

    const stats = {
      totalOrders: totalOrders,
      totalRevenue: totalRevenue,
      allOrders: orders.length,
      pendingOrders: orders.filter(o => !o.isPlaced).length,
      allotedOrders: allotedOrders,
      confirmedOrders: confirmedOrders
    };

    res.json({
      success: true,
      brandName: brandName,
      stats: stats,
      orders: orders
    });
  } catch (err) {
    console.error("Error fetching brand dashboard:", err);
    res.status(500).json({ success: false, message: "Error fetching brand data" });
  }
});

router.get("/list", authMiddleware, async (req, res) => {
  try {
    const brands = await Order.distinct("brandName");
    const brandList = brands.filter(b => b && b.trim() !== "");
    res.json({ success: true, brands: brandList });
  } catch (err) {
    console.error("Error fetching brand list:", err);
    res.status(500).json({ success: false, message: "Error fetching brand list" });
  }
});

module.exports = router;
