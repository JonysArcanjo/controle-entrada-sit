function getDryRunDelay(job, config) {
  const jobDelay = Number(job && job.simulationDelayMs);
  if (Number.isInteger(jobDelay) && jobDelay > 0) {
    return jobDelay;
  }

  const configuredDelay = Number(config && config.dryRunDelayMs);
  return Number.isInteger(configuredDelay) && configuredDelay > 0 ? configuredDelay : 1000;
}

module.exports = { getDryRunDelay };
