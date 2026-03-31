/** Application funnel stages (stored in applications.status). */
export const APPLICATION_STATUSES = [
  "pending",
  "reviewing",
  "qualified",
  "interview",
  "shortlisted",
  "offer",
  "rejected",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export function isApplicationStatus(s: string): s is ApplicationStatus {
  return (APPLICATION_STATUSES as readonly string[]).includes(s);
}

export function applicationStatusLabel(status: string): string {
  switch (status) {
    case "pending":
      return "Submitted";
    case "reviewing":
      return "Under review";
    case "qualified":
      return "Qualified";
    case "interview":
      return "Interview";
    case "shortlisted":
      return "Shortlisted";
    case "offer":
      return "Offer";
    case "rejected":
      return "Not selected";
    default:
      return status;
  }
}

export function applicationStatusExplainer(status: string): string {
  switch (status) {
    case "reviewing":
      return "The employer is reviewing your application.";
    case "qualified":
      return "The employer has marked you as qualified for this role. Check their note and messages.";
    case "interview":
      return "You are in the interview stage. Watch for scheduling details in the note or message thread.";
    case "shortlisted":
      return "You have been shortlisted. The employer may follow up via note or messages.";
    case "offer":
      return "An offer or next-step update may be described in the employer note below.";
    case "rejected":
      return "This application was not progressed further. You can still explore other listings.";
    case "pending":
    default:
      return "Your application has been received and is waiting for the employer to move it forward.";
  }
}

export type StatusTone = "positive" | "negative" | "neutral" | "progress";

export function applicationStatusTone(status: string): StatusTone {
  if (status === "rejected") return "negative";
  if (status === "pending") return "neutral";
  if (status === "reviewing") return "neutral";
  return "positive";
}
