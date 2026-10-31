/** Cluster priority: the most severe report, boosted by how many people reported it. */
export function clusterPriority(reportPriorities: number[], count: number): number {
  const top = reportPriorities.length ? Math.max(...reportPriorities) : 0;
  return Math.min(100, Math.round(top + 6 * Math.log(1 + count) - 6 * Math.log(2)));
}
