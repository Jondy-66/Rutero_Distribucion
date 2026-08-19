'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Mail, Send, LoaderCircle, AlertTriangle, ShieldCheck, Code, Settings } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

/**
 * Componente administrativo para validar la configuración de envío de correos.
 * Demuestra el consumo de la API Route /api/admin/send-test-email.
 */
export default function EmailTestPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    to: '',
    subject: 'Routify: Prueba de Conectividad',
    text: 'Validación exitosa del transporte Nodemailer mediante el servicio de Gmail.',
  });

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validar formato de correo electrónico
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.to)) {
      toast({
        title: "CORREO INVÁLIDO",
        description: "Por favor, ingresa una dirección de correo electrónico válida en formato minúsculas.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // --- EJEMPLO DE CONSUMO DE LA API ROUTE ---
      const response = await fetch('/api/admin/send-test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast({
          title: "¡ENVÍO EXITOSO!",
          description: "Revisa la bandeja de entrada de " + formData.to,
          className: "bg-green-600 text-white font-black"
        });
      } else {
        throw new Error(result.message || 'Fallo en la comunicación con el servidor de correo.');
      }
    } catch (error: any) {
      console.error(error);
      toast({
        title: "FALLO EN EL SERVIDOR",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Configuración de Email" 
        description="Auditoría y pruebas del servidor de notificaciones automáticas." 
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <form onSubmit={handleSendTest}>
            <Card className="border-t-4 border-t-primary shadow-2xl rounded-[2rem] overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b">
                <div className="flex items-center gap-4">
                    <div className="bg-primary/10 p-3 rounded-2xl">
                        <Mail className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <CardTitle className="font-black uppercase text-slate-950">Prueba de Nodemailer</CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase text-slate-500">
                            Lanza una petición POST a la API para verificar tus credenciales.
                        </CardDescription>
                    </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 pt-8">
                <div className="space-y-2">
                  <Label htmlFor="to" className="font-black text-[10px] uppercase text-slate-500 tracking-widest pl-1">Correo del Destinatario</Label>
                  <Input 
                    id="to" 
                    type="email" 
                    placeholder="ejemplo@farmaenlace.com" 
                    required 
                    value={formData.to}
                    onChange={(e) => setFormData({ ...formData, to: e.target.value.toLowerCase() })}
                    className="font-black border-2 h-12 rounded-xl focus:ring-4 focus:ring-primary/5 text-slate-950"
                  />
                  <p className="text-[9px] font-bold text-muted-foreground uppercase pl-1">Solo se permiten minúsculas y formato de correo válido.</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="subject" className="font-black text-[10px] uppercase text-slate-500 tracking-widest pl-1">Asunto del Mensaje</Label>
                  <Input 
                    id="subject" 
                    required 
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="font-black border-2 h-12 rounded-xl text-slate-950 uppercase"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="text" className="font-black text-[10px] uppercase text-slate-500 tracking-widest pl-1">Contenido de la Prueba</Label>
                  <Textarea 
                    id="text" 
                    required 
                    rows={4}
                    value={formData.text}
                    onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                    className="font-black border-2 rounded-2xl text-slate-950 text-sm focus:ring-4 focus:ring-primary/5"
                  />
                </div>
              </CardContent>
              <CardFooter className="bg-slate-50 p-6 flex justify-end">
                <Button 
                    type="submit" 
                    disabled={loading} 
                    className="font-black px-10 h-14 rounded-2xl shadow-xl uppercase transition-all hover:scale-[1.02]"
                >
                  {loading ? <LoaderCircle className="animate-spin mr-2 h-5 w-5" /> : <Send className="mr-2 h-5 w-5" />}
                  EJECUTAR TEST DE ENVÍO
                </Button>
              </CardFooter>
            </Card>
          </form>
        </div>

        <div className="space-y-6">
          <Alert className="border-primary bg-primary/5 rounded-2xl shadow-sm">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <AlertTitle className="text-primary font-black uppercase text-xs">Integridad del Setup</AlertTitle>
            <AlertDescription className="text-slate-600 font-bold uppercase text-[9px] leading-relaxed mt-1">
              Este módulo utiliza <span className="font-black underline">service: 'gmail'</span>. Asegúrate de que las variables en tu proveedor de hosting estén activas.
            </AlertDescription>
          </Alert>

          <Card className="bg-slate-950 text-white border-none shadow-2xl rounded-[2rem] overflow-hidden">
            <CardHeader className="pb-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                    <Code className="h-4 w-4 text-primary" />
                    <CardTitle className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Configuración .env.local</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="pt-6 font-mono text-[10px] space-y-4">
                <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                    <p className="text-slate-500 mb-1"># Servidor de Correo</p>
                    <p className="text-green-400">EMAIL_USER="tu-cuenta@gmail.com"</p>
                    <p className="text-green-400">EMAIL_PASS="xxxx xxxx xxxx xxxx"</p>
                </div>
                
                <div className="flex flex-col gap-2">
                    <Badge variant="outline" className="border-primary/30 text-primary uppercase text-[8px] w-fit">Nota de Seguridad</Badge>
                    <p className="text-slate-400 leading-relaxed uppercase font-bold text-[9px]">
                        Gmail requiere una "Contraseña de Aplicación". No utilices tu clave personal de acceso directo.
                    </p>
                </div>
            </CardContent>
            <CardFooter className="pt-0 pb-6">
                <Button variant="ghost" className="w-full text-white/40 hover:text-white hover:bg-white/5 font-black uppercase text-[10px] gap-2" asChild>
                    <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer">
                        <Settings className="h-3 w-3" /> Configurar Contraseña Google
                    </a>
                </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
