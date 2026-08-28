"use client";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";
type Props = React.ComponentProps<typeof Button> & { pendingLabel?: string };
export function SubmitButton({children,pendingLabel="Saving…",disabled,...props}:Props){
  const {pending}=useFormStatus();
  return <Button type="submit" disabled={disabled||pending} aria-disabled={disabled||pending} {...props}>{pending?pendingLabel:children}</Button>;
}
