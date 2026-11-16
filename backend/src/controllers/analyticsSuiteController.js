const { StatusCodes } = require("http-status-codes");
const asyncHandler = require("../utils/asyncHandler");
const analyticsSuiteService = require("../services/analyticsSuiteService");

const getSuite = asyncHandler(async (_req, res) => {
  const snapshot = await analyticsSuiteService.getAnalyticsSnapshot();
  const insights = await analyticsSuiteService.getWeeklyInsight(snapshot);

  res.status(StatusCodes.OK).json({
    success: true,
    data: {
      ...snapshot,
      insights,
      generatedAt: new Date().toISOString(),
    },
  });
});

const exportCsv = asyncHandler(async (_req, res) => {
  const snapshot = await analyticsSuiteService.getAnalyticsSnapshot();
  const rows = snapshot.revenueSeries;
  const csv = analyticsSuiteService.toCsv(rows);

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=analytics-revenue.csv");
  res.status(StatusCodes.OK).send(csv);
});

const exportPdf = asyncHandler(async (_req, res) => {
  const snapshot = await analyticsSuiteService.getAnalyticsSnapshot();
  const pdf = await analyticsSuiteService.toPdfBuffer("Foodex Analytics Weekly", snapshot.revenueSeries);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=analytics-weekly.pdf");
  res.status(StatusCodes.OK).send(pdf);
});

module.exports = {
  getSuite,
  exportCsv,
  exportPdf,
};
