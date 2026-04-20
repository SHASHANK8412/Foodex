const PDFDocument = require("pdfkit");
const { StatusCodes } = require("http-status-codes");
const Invoice = require("../models/Invoice");
const Order = require("../models/Order");
const ApiError = require("../utils/ApiError");

const generateInvoiceNumber = () => {
  const stamp = Date.now().toString().slice(-8);
  const random = Math.floor(1000 + Math.random() * 9000);
  return `INV-${stamp}-${random}`;
};

const buildInvoiceFromOrder = (order) => {
  return {
    invoiceNumber: generateInvoiceNumber(),
    order: order._id,
    user: order.user?._id || order.user,
    restaurant: order.restaurant?._id || order.restaurant,
    customerSnapshot: {
      name: order.user?.name || "Customer",
      email: order.user?.email || "",
      phone: order.user?.phone || "",
      address: {
        line1: order.deliveryAddress?.line1 || "",
        city: order.deliveryAddress?.city || "",
        state: order.deliveryAddress?.state || "",
        postalCode: order.deliveryAddress?.postalCode || "",
      },
    },
    restaurantSnapshot: {
      name: order.restaurant?.name || "Restaurant",
      address: {
        line1: order.restaurant?.address?.line1 || "",
        city: order.restaurant?.address?.city || "",
        state: order.restaurant?.address?.state || "",
        postalCode: order.restaurant?.address?.postalCode || "",
      },
      contactPhone: order.restaurant?.contactPhone || "",
    },
    items: (order.items || []).map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.price,
      lineTotal: Number((item.quantity * item.price).toFixed(2)),
    })),
    subtotal: order.subtotal,
    taxAmount: order.taxAmount,
    deliveryCharges: order.deliveryFee,
    totalAmount: order.totalAmount,
    currency: "INR",
  };
};

const ensureInvoiceForOrder = async (orderId) => {
  const existing = await Invoice.findOne({ order: orderId });
  if (existing) {
    return existing;
  }

  const order = await Order.findById(orderId)
    .populate("user", "name email phone")
    .populate("restaurant", "name address contactPhone");

  if (!order) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Order not found for invoice generation");
  }

  const payload = buildInvoiceFromOrder(order);
  return Invoice.create(payload);
};

const getInvoiceForOrder = async (orderId) => {
  return Invoice.findOne({ order: orderId });
};

const toPdfBuffer = async (invoice) => {
  const doc = new PDFDocument({ margin: 36 });
  const chunks = [];

  return new Promise((resolve) => {
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    doc.fontSize(18).text("Foodex Invoice", { align: "left" });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Invoice: ${invoice.invoiceNumber}`);
    doc.text(`Generated: ${new Date(invoice.generatedAt).toLocaleString()}`);
    doc.moveDown();

    doc.fontSize(12).text("Restaurant Details", { underline: true });
    doc.fontSize(10).text(invoice.restaurantSnapshot?.name || "Restaurant");
    doc.text(
      `${invoice.restaurantSnapshot?.address?.line1 || ""}, ${invoice.restaurantSnapshot?.address?.city || ""}, ${invoice.restaurantSnapshot?.address?.state || ""} ${invoice.restaurantSnapshot?.address?.postalCode || ""}`
    );
    if (invoice.restaurantSnapshot?.contactPhone) {
      doc.text(`Phone: ${invoice.restaurantSnapshot.contactPhone}`);
    }
    doc.moveDown();

    doc.fontSize(12).text("Customer Details", { underline: true });
    doc.fontSize(10).text(invoice.customerSnapshot?.name || "Customer");
    if (invoice.customerSnapshot?.email) {
      doc.text(`Email: ${invoice.customerSnapshot.email}`);
    }
    if (invoice.customerSnapshot?.phone) {
      doc.text(`Phone: ${invoice.customerSnapshot.phone}`);
    }
    doc.text(
      `${invoice.customerSnapshot?.address?.line1 || ""}, ${invoice.customerSnapshot?.address?.city || ""}, ${invoice.customerSnapshot?.address?.state || ""} ${invoice.customerSnapshot?.address?.postalCode || ""}`
    );
    doc.moveDown();

    doc.fontSize(12).text("Items", { underline: true });
    doc.moveDown(0.5);

    (invoice.items || []).forEach((item) => {
      doc
        .fontSize(10)
        .text(`${item.name} x ${item.quantity}`, { continued: true })
        .text(`Rs ${item.lineTotal.toFixed(2)}`, { align: "right" });
    });

    doc.moveDown();
    doc.fontSize(10).text(`Subtotal: Rs ${Number(invoice.subtotal || 0).toFixed(2)}`, { align: "right" });
    doc.text(`GST/Taxes: Rs ${Number(invoice.taxAmount || 0).toFixed(2)}`, { align: "right" });
    doc.text(`Delivery: Rs ${Number(invoice.deliveryCharges || 0).toFixed(2)}`, { align: "right" });
    doc.fontSize(12).text(`Total: Rs ${Number(invoice.totalAmount || 0).toFixed(2)}`, { align: "right" });

    doc.end();
  });
};

module.exports = {
  ensureInvoiceForOrder,
  getInvoiceForOrder,
  toPdfBuffer,
};
