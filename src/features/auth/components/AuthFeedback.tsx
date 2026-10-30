import { Alert } from "@/components/feedback/Alert";
import type { AuthActionState } from "@/features/auth/state";

export function AuthFeedback({ state }: { state: AuthActionState }) {
  if (!state.message) {
    return null;
  }

  return (
    <Alert variant={state.status === "error" ? "error" : "info"}>
      {state.message}
    </Alert>
  );
}
