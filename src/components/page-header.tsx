import { cn } from "@/lib/utils";

interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
    title: string;
    description?: string;
    children?: React.ReactNode;
}

export function PageHeader({ title, description, children, className, ...props }: PageHeaderProps) {
    return (
        <div className={cn("flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between mb-6", className)} {...props}>
            <div>
                <h1 className="text-3xl font-bold tracking-tight font-headline">{title}</h1>
                {description && <p className="text-muted-foreground">{description}</p>}
            </div>
            {children && <div className="flex items-center space-x-2">{children}</div>}
        </div>
    )
}
