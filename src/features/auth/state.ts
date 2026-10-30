export type AuthActionState = {
  fieldErrors?: Record<string, string[]>;
  message?: string;
  status: "idle" | "error" | "success";
};

export const initialAuthActionState: AuthActionState = { status: "idle" };
