import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface FloatingLabelPasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

const FloatingLabelPasswordInput = React.forwardRef<HTMLInputElement, FloatingLabelPasswordInputProps>(
  ({ className, label, id, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false);

    return (
      <div className="relative">
        <Input
          ref={ref}
          id={id}
          type={showPassword ? 'text' : 'password'}
          className={cn('peer h-12 pt-4 pr-10', className)}
          placeholder=" "
          {...props}
        />
        <Label
          htmlFor={id}
          className="absolute left-3 top-3.5 text-muted-foreground transition-all duration-300 peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-base peer-focus:top-1.5 peer-focus:-translate-y-1 peer-focus:text-xs peer-focus:text-primary peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:-translate-y-1 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:text-primary"
        >
          {label}
        </Label>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute inset-y-0 right-0 flex items-center h-full px-3 text-muted-foreground hover:text-foreground"
          onClick={() => setShowPassword((prev) => !prev)}
          aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </Button>
      </div>
    );
  }
);
FloatingLabelPasswordInput.displayName = 'FloatingLabelPasswordInput';

export { FloatingLabelPasswordInput };
