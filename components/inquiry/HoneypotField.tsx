// components/inquiry/HoneypotField.tsx
import type { UseFormRegisterReturn } from "react-hook-form";

export function HoneypotField({ register }: { register: UseFormRegisterReturn }) {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden">
      <label>
        Leave this field empty
        <input type="text" tabIndex={-1} autoComplete="off" {...register} />
      </label>
    </div>
  );
}
