const SyncRun = require("../models/SyncRun");

/**
 * Create a new sync run.
 */
async function startSyncRun(supplier) {
  return SyncRun.create({
    supplier,
    status: "running",
    startedAt: new Date(),
  });
}

async function isSyncRunning(supplier) {
  const runningSync = await SyncRun.findOne({
    supplier,
    status: "running",
  }).lean();

  return Boolean(runningSync);
}

async function getRunningSync(supplier) {
  return SyncRun.findOne({
    supplier,
    status: "running",
  }).sort({ startedAt: -1 });
}

async function updateSyncProgress(syncRunId, updates) {
  return SyncRun.findByIdAndUpdate(
    syncRunId,
    {
      $set: {
        ...updates,
        updatedAt: new Date(), // heartbeat for live progress
      },
    },
    { new: true }
  );
}

/**
 * Mark sync as completed.
 */
async function completeSyncRun(syncRunId, stats) {
  const finishedAt = new Date();

  const durationSeconds = Math.round(
    (finishedAt - stats.startedAt) / 1000
  );

  return SyncRun.findByIdAndUpdate(
    syncRunId,
    {
      status: "completed",
      finishedAt,
      durationSeconds,

      categoriesScanned: stats.categoriesScanned,
      listingsFound: stats.listingsFound,
      productsScraped: stats.productsScraped,
      productsSkipped: stats.productsSkipped,

      inserted: stats.inserted,
      updated: stats.updated,
      failed: stats.failed,
      removed: stats.removed || 0,
      reactivated: stats.reactivated || 0,
      duplicateListings: stats.duplicateListings || 0,
      successRate: stats.successRate || 0,
      healthStatus: stats.healthStatus || "healthy",
    },
    { new: true }
  );
}

/**
 * Mark sync as failed.
 */
async function failSyncRun(syncRunId, error) {
  return SyncRun.findByIdAndUpdate(syncRunId, {
    status: "failed",
    finishedAt: new Date(),
    notes: error.message,
  });
}


module.exports = {
  startSyncRun,
  completeSyncRun,
  failSyncRun,
  isSyncRunning,
  updateSyncProgress,
  getRunningSync,
};