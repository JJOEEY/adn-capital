import { WorkflowDefinition } from "./types";

export const WORKFLOW_DEFINITIONS: WorkflowDefinition[] = [
  {
    workflowKey: "cron-canonical-pulse",
    title: "Cron Canonical Pulse",
    enabled: true,
    tags: ["cron", "ops", "runtime"],
    trigger: {
      type: "cron",
      config: {
        cronTypes: ["signal_scan_type1"],
      },
    },
    actions: [
      {
        type: "write_log",
        params: {
          action: "WORKFLOW_CRON_PULSE",
          description: "Cron pulse accepted for {{payload.cronType}} with status={{payload.status}}",
        },
        deterministic: true,
      },
    ],
  },
  {
    workflowKey: "morning-brief-ready-refresh",
    title: "Morning Brief Ready Refresh",
    enabled: true,
    tags: ["brief", "dashboard", "datahub"],
    trigger: {
      type: "brief_ready",
      config: {
        reportTypes: ["morning_brief"],
      },
    },
    actions: [
      {
        type: "invalidate_topic",
        params: {
          tags: ["news", "brief", "dashboard", "market"],
        },
        deterministic: true,
      },
      {
        type: "refresh_topic",
        continueOnError: true,
        params: {
          topics: ["news:morning:latest", "vn:index:overview", "vn:index:snapshot"],
        },
        deterministic: true,
      },
      {
        type: "persist_report",
        continueOnError: true,
        params: {
          reportType: "{{payload.reportType}}",
          title: "{{payload.title}}",
          content: "{{payload.content}}",
          dedupe: true,
          dedupeWindowMinutes: 45,
        },
        deterministic: true,
      },
      {
        type: "write_log",
        params: {
          action: "WORKFLOW_BRIEF_READY",
          description: "Workflow morning brief refresh completed for {{payload.reportType}}",
        },
        deterministic: true,
      },
    ],
  },
  {
    workflowKey: "signal-active-notify",
    title: "Signal Active Notify",
    enabled: true,
    tags: ["signal", "notification"],
    trigger: {
      type: "signal_status_changed",
      config: {
        toStatuses: ["ACTIVE"],
      },
    },
    actions: [
      {
        type: "invalidate_topic",
        params: {
          tags: ["signal", "broker", "portfolio"],
        },
        deterministic: true,
      },
      {
        type: "create_notification",
        params: {
          type: "signal_active_workflow",
          title: "🟢 {{payload.ticker}} chuyển ACTIVE",
          content:
            "Signal {{payload.ticker}} ({{payload.signalType}}) chuyển từ {{payload.fromStatus}} -> {{payload.toStatus}} tại giá {{payload.entryPrice}}.",
        },
        deterministic: false,
      },
      {
        type: "send_telegram",
        continueOnError: true,
        params: {
          text: "🟢 *Signal ACTIVE* {{payload.ticker}} ({{payload.signalType}}) - Entry {{payload.entryPrice}}",
        },
        deterministic: false,
      },
      {
        type: "write_log",
        params: {
          action: "WORKFLOW_SIGNAL_ACTIVE",
          description: "Signal {{payload.ticker}} entered ACTIVE",
        },
        deterministic: true,
      },
    ],
  },
  {
    workflowKey: "portfolio-risk-alert",
    title: "Portfolio Risk Alert",
    enabled: true,
    tags: ["portfolio", "risk", "alert"],
    trigger: {
      type: "portfolio_risk_threshold",
      config: {
        metricPath: "payload.riskPercent",
        op: "gte",
        value: 70,
      },
    },
    actions: [
      {
        type: "create_notification",
        params: {
          type: "portfolio_risk_alert",
          title: "⚠️ Cảnh báo rủi ro danh mục",
          content:
            "Danh mục của user {{payload.userId}} có risk={{payload.riskPercent}}%. Kích hoạt chế độ kiểm soát rủi ro.",
        },
        deterministic: false,
      },
      {
        type: "send_telegram",
        continueOnError: true,
        params: {
          text: "⚠️ *Portfolio Risk Alert* user={{payload.userId}} risk={{payload.riskPercent}}%",
        },
        deterministic: false,
      },
      {
        type: "write_log",
        params: {
          action: "WORKFLOW_PORTFOLIO_RISK",
          description: "Portfolio risk threshold reached for user {{payload.userId}}",
        },
        deterministic: true,
      },
    ],
  },
];
