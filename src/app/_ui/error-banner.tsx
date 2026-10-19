import { Icon } from './icons';

/** The one error banner: shows the server's message as written, above the form that failed. */
export function ErrorBanner({ message }: { message: string }) {
  return (
    <p role="alert" className="mb-4 flex items-center gap-2 rounded-[14px] bg-danger-soft px-4 py-3 text-danger">
      <Icon name="alert" className="size-[18px] shrink-0" />
      {message}
    </p>
  );
}
