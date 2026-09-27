"use client";

import { useActionState } from "react";
import { sendFriendRequest } from "@/actions/friends";
import { SubmitButton } from "@/components/client";
import { FormMessage } from "@/components/ui";

export function AddFriendForm() {
  const [state, action] = useActionState(sendFriendRequest, null);
  return (
    <form action={action} className="space-y-3">
      <label htmlFor="friend" className="sr-only">Username or PSN ID</label>
      <input id="friend" name="username" required placeholder="Username or PSN ID" className="input" />
      <SubmitButton className="btn-primary w-full">Send request</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
