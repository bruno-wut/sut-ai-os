"use client";

import { Activity, AlertTriangle, CheckCircle2, Clock3, RefreshCw, ServerCog } from "lucide-react";

import type { SystemHealthData } from "@/lib/system-health-data";
import { requeueDeadLetter } from "@/app/(staff)/staff/system-health/actions";

function metricValue(value: number) {
  return value.toLocaleString("en-GB");
}

export function SystemHealthDashboard({
  canRecover,
  systemHealth,
}: Readonly<{
  canRecover: boolean;
  systemHealth: SystemHealthData;
}>) {
  const summary = systemHealth.summary;
  const connected = systemHealth.connected && Boolean(summary);
  const integrationsReady = systemHealth.integrations.every((integration) => integration.status === "Ready");
  const healthy = connected
    && integrationsReady
    && !summary.operationalJobIsStale
    && summary.notificationStaleProcessingCount === 0
    && summary.notificationDeadLetterCount === 0
    && summary.adverseProviderEvents24h === 0;

  return (
    <>
      <div className={`health-banner ${healthy ? "health-banner--healthy" : ""}`} role="status">
        {healthy ? <CheckCircle2 aria-hidden="true" size={20} /> : <AlertTriangle aria-hidden="true" size={20} />}
        <div>
          <strong>
            {!connected
              ? "System health data is currently unavailable"
              : healthy
                ? `Operational worker last ran ${summary.latestRunAgeLabel}`
                : "Operational worker or notification queue needs attention"}
          </strong>
          <p>
            {!connected
              ? "We could not load the authenticated health views for this staff session."
              : healthy
                ? "Scheduled operations are current and no messages are stuck in delivery."
                : `${summary.schedulerStatusNote} Stuck deliveries: ${metricValue(summary.notificationStaleProcessingCount)}. Messages needing manual recovery: ${metricValue(summary.notificationDeadLetterCount)}. Provider delivery failures (24h): ${metricValue(summary.adverseProviderEvents24h)}.`}
          </p>
        </div>
      </div>

      <section aria-label="System Health summary" className="metrics-grid health-metrics">
        <article className="metric-card"><div className="metric-card__label">Latest worker run<Clock3 aria-hidden="true" size={17} /></div><p className="metric-card__value">{summary?.latestRunAgeLabel ?? "N/A"}</p><p className="metric-card__detail">{summary?.latestRunStatus ?? "No worker run recorded"}</p></article>
        <article className="metric-card"><div className="metric-card__label">Failures · 24h<AlertTriangle aria-hidden="true" size={17} /></div><p className="metric-card__value">{metricValue(summary?.failuresLast24Hours ?? 0)}</p><p className="metric-card__detail">Background-job failures</p></article>
        <article className="metric-card"><div className="metric-card__label">Stuck deliveries<Activity aria-hidden="true" size={17} /></div><p className="metric-card__value">{metricValue(summary?.notificationStaleProcessingCount ?? 0)}</p><p className="metric-card__detail">Messages needing attention</p></article>
        <article className="metric-card"><div className="metric-card__label">Scheduler<ServerCog aria-hidden="true" size={17} /></div><p className="metric-card__value metric-card__value--text">{summary?.schedulerStatusLabel ?? "Check"}</p><p className="metric-card__detail">{summary?.schedulerStatusNote ?? "Worker heartbeat unavailable"}</p></article>
        <article className="metric-card"><div className="metric-card__label">Email suppressions<AlertTriangle aria-hidden="true" size={17} /></div><p className="metric-card__value">{metricValue(summary?.activeEmailSuppressionCount ?? 0)}</p><p className="metric-card__detail">Active blocked recipients</p></article>
      </section>

      <section aria-label="Integration health" className="staff-panel integration-health">
        <header className="staff-panel__header"><h2>Integration health</h2><span>Live authenticated probes</span></header>
        <div className="readiness-list">
          {systemHealth.integrations.map((integration) => (
            <div key={integration.name}>
              <span>{integration.status === "Ready" ? <CheckCircle2 aria-hidden="true" size={17} /> : <AlertTriangle aria-hidden="true" size={17} />}{integration.name}<small>{integration.detail}</small></span>
              <strong className={integration.status === "Ready" ? "status-ready" : "status-warning"}>{integration.status}</strong>
            </div>
          ))}
        </div>
        <p className="sr-only">{integrationsReady ? "All integrations are ready." : "One or more integrations need attention."}</p>
      </section>

      <div className="staff-grid health-grid">
        <section className="staff-panel"><header className="staff-panel__header"><h2>Operational readiness</h2><span>Live worker state</span></header><div className="readiness-list"><div><span><CheckCircle2 aria-hidden="true" size={17} />Database functions</span><strong>Validated</strong></div><div><span><CheckCircle2 aria-hidden="true" size={17} />Notification leasing</span><strong>Validated</strong></div><div><span><RefreshCw aria-hidden="true" size={17} />hotel-bridge-operational-jobs</span><strong>{summary?.operationalJobIsStale ? "Needs attention" : "Healthy"}</strong></div><div><span><RefreshCw aria-hidden="true" size={17} />hotel-bridge-retention-jobs</span><strong>Verify at launch</strong></div></div></section>
        <section className="staff-panel"><header className="staff-panel__header"><h2>Queue health</h2><span>Leased delivery</span></header><div className="status-list"><div className="status-list__item"><span>Ready to claim</span><strong>{metricValue(summary?.notificationReadyToClaimCount ?? 0)}</strong></div><div className="status-list__item"><span>Processing</span><strong>{metricValue(summary?.notificationProcessingCount ?? 0)}</strong></div><div className="status-list__item"><span>Failed / retrying</span><strong>{metricValue(summary?.notificationRetryingCount ?? 0)}</strong></div><div className="status-list__item"><span>Dead letter</span><strong>{metricValue(summary?.notificationDeadLetterCount ?? 0)}</strong></div></div></section>
      </div>

      <section className="staff-panel failed-jobs"><header className="staff-panel__header"><h2>Recent failed background jobs</h2><span>Database view limited to five</span></header>{!systemHealth.recentFailures.length ? <div className="table-empty"><CheckCircle2 aria-hidden="true" size={22} />No recent background-job failures.</div> : <div className="data-table-wrap"><table className="data-table"><thead><tr><th scope="col">Job</th><th scope="col">Started</th><th scope="col">Error summary</th><th scope="col">Status</th></tr></thead><tbody>{systemHealth.recentFailures.map((failure) => <tr key={failure.id}><td><strong>{failure.jobName}</strong></td><td>{failure.startedAtLabel}</td><td>{failure.errorSummary}</td><td><span className="status-pill status-pill--failed">{failure.status}</span></td></tr>)}</tbody></table></div>}</section>

      <section className="staff-panel failed-jobs"><header className="staff-panel__header"><h2>Dead-letter notifications</h2><span>Exhausted retries</span></header>{!systemHealth.deadLetters.length ? <div className="table-empty"><CheckCircle2 aria-hidden="true" size={22} />No notifications have exhausted retry limits.</div> : <div className="data-table-wrap"><table className="data-table"><thead><tr><th scope="col">Kind</th><th scope="col">Recipient</th><th scope="col">Attempts</th><th scope="col">Latest update</th><th scope="col">Error summary</th>{canRecover ? <th scope="col">Recovery</th> : null}</tr></thead><tbody>{systemHealth.deadLetters.map((event) => <tr key={event.id}><td><strong>{event.kind}</strong></td><td>{event.recipient}</td><td>{metricValue(event.attempts)}</td><td>{event.updatedAtLabel}</td><td>{event.errorSummary}</td>{canRecover ? <td><form action={requeueDeadLetter}><input name="eventId" type="hidden" value={event.id} /><input aria-label={`Reason for replaying ${event.kind} notification`} minLength={10} name="reason" placeholder="Verified recovery reason" required type="text" /><button className="button button--secondary" type="submit">Requeue</button></form></td> : null}</tr>)}</tbody></table></div>}</section>
    </>
  );
}
