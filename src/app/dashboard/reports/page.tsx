'use client'
import { redirect } from "next/navigation";

export default function ReportsRedirectPage() {
    redirect('/dashboard/reports/my-reports');
}
