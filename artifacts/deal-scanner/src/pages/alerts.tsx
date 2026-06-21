import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Bell, Trash2, Play, Plus, ChevronDown, ChevronRight, CheckCircle2, XCircle, Terminal, HelpCircle } from "lucide-react";
import {
  useListAlertConfigs,
  useCreateAlertConfig,
  useUpdateAlertConfig,
  useDeleteAlertConfig,
  useTestAlertConfig,
  useListAlertLogs,
  getListAlertConfigsQueryKey,
  getListAlertLogsQueryKey
} from "@workspace/api-client-react";
import type { AlertConfig } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";

const alertFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["webhook", "discord", "slack"]),
  url: z.string().url("Must be a valid URL"),
  minScore: z.number().min(1).max(10),
  enabled: z.boolean().default(true)
});

const AlertLogsList = ({ alertId }: { alertId: number }) => {
  const { data: logs, isLoading } = useListAlertLogs(alertId);

  if (isLoading) return <div className="p-4"><Skeleton className="h-20 w-full bg-muted/20" /></div>;

  if (!logs || logs.length === 0) {
    return <div className="p-4 text-xs text-muted-foreground font-mono">No delivery logs found.</div>;
  }

  return (
    <div className="flex flex-col gap-1 p-2 bg-black/40 rounded-md border border-border/50 max-h-60 overflow-y-auto font-mono text-xs">
      {logs.map((log: any) => (
        <div key={log.id} className="flex items-center gap-2 p-1.5 hover:bg-muted/30 rounded">
          {log.success ? <CheckCircle2 className="w-3 h-3 text-primary" /> : <XCircle className="w-3 h-3 text-destructive" />}
          <span className="text-muted-foreground">{new Date(log.sentAt).toLocaleString()}</span>
          <span className="text-muted-foreground">| Deal #{log.dealId}</span>
          {!log.success && log.errorMessage && (
            <span className="text-destructive truncate ml-2" title={log.errorMessage}>- {log.errorMessage}</span>
          )}
        </div>
      ))}
    </div>
  );
}

const AlertCard = ({ alert }: { alert: any }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateAlert = useUpdateAlertConfig();
  const deleteAlert = useDeleteAlertConfig();
  const testAlert = useTestAlertConfig();
  const [logsOpen, setLogsOpen] = useState(false);

  const handleToggle = (checked: boolean) => {
    updateAlert.mutate(
      { id: alert.id, data: { enabled: checked } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAlertConfigsQueryKey() });
          toast({ title: "Alert updated", description: `${alert.name} is now ${checked ? 'enabled' : 'disabled'}` });
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to update alert", variant: "destructive" });
        }
      }
    );
  };

  const handleDelete = () => {
    if (!confirm("Delete this alert?")) return;
    deleteAlert.mutate(
      { id: alert.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAlertConfigsQueryKey() });
          toast({ title: "Alert deleted" });
        }
      }
    );
  };

  const handleTest = () => {
    testAlert.mutate(
      { id: alert.id },
      {
        onSuccess: (data: any) => {
          if (data.success) {
            toast({ title: "Test successful", description: data.message });
          } else {
            toast({ title: "Test failed", description: data.message, variant: "destructive" });
          }
          queryClient.invalidateQueries({ queryKey: getListAlertLogsQueryKey(alert.id) });
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to run test", variant: "destructive" });
        }
      }
    );
  };

  return (
    <Card className="bg-card/50 border-border/50 rounded-md">
      <CardContent className="p-4 flex flex-col gap-4">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1 min-w-0 flex-1 pr-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm tracking-wide text-foreground truncate">{alert.name}</span>
              <Badge variant="outline" className="font-mono text-[10px] uppercase bg-secondary/30">{alert.type}</Badge>
              <Badge variant="outline" className={`font-mono text-[10px] uppercase ${alert.enabled ? 'bg-primary/20 text-primary border-primary/30' : 'bg-muted/50 text-muted-foreground'}`}>
                {alert.enabled ? "ACTIVE" : "DISABLED"}
              </Badge>
            </div>
            <div className="text-xs font-mono text-muted-foreground truncate" title={alert.url}>
              {alert.url}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Switch checked={alert.enabled} onCheckedChange={handleToggle} />
            <Button variant="ghost" size="icon" onClick={handleDelete} className="text-muted-foreground hover:text-destructive h-8 w-8">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs border-t border-border/30 pt-3 mt-1">
          <div className="flex items-center gap-4 text-muted-foreground">
            <span className="font-mono">MIN SCORE: <span className="text-foreground">{alert.minScore}</span></span>
            <span className="font-mono">CREATED: <span className="text-foreground">{new Date(alert.createdAt).toLocaleDateString()}</span></span>
          </div>
          <Button variant="outline" size="sm" onClick={handleTest} disabled={testAlert.isPending} className="h-7 text-xs bg-transparent hover:bg-secondary/50">
            <Play className="w-3 h-3 mr-2 text-primary" />
            TEST
          </Button>
        </div>

        <Collapsible open={logsOpen} onOpenChange={setLogsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full h-7 text-[10px] font-mono justify-between text-muted-foreground mt-2 border border-dashed border-border/50 hover:bg-secondary/30">
              <span>DELIVERY LOGS</span>
              {logsOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <AlertLogsList alertId={alert.id} />
          </CollapsibleContent>
        </Collapsible>

      </CardContent>
    </Card>
  );
};

export default function Alerts() {
  const { data: alerts, isLoading } = useListAlertConfigs();
  const createAlert = useCreateAlertConfig();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof alertFormSchema>>({
    resolver: zodResolver(alertFormSchema),
    defaultValues: {
      name: "",
      type: "webhook",
      url: "",
      minScore: 7,
      enabled: true
    }
  });

  const onSubmit = (values: z.infer<typeof alertFormSchema>) => {
    createAlert.mutate(
      { data: values },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAlertConfigsQueryKey() });
          toast({ title: "Alert created successfully" });
          form.reset();
        },
        onError: () => {
          toast({ title: "Failed to create alert", variant: "destructive" });
        }
      }
    );
  };

  return (
    <Layout>
      <div className="p-6 border-b border-border bg-card/30 flex items-center justify-between sticky top-0 z-10 backdrop-blur-md">
        <div>
          <h1 className="text-xl font-bold tracking-tight uppercase flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            Alert Configurations
          </h1>
          <p className="text-xs text-muted-foreground mt-1 font-mono">Manage notification targets for high-value deals</p>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl mx-auto">
        <div className="lg:col-span-4 flex flex-col gap-6">
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-4 border-b border-border/30">
              <CardTitle className="text-sm uppercase tracking-wider flex items-center gap-2">
                <Plus className="w-4 h-4 text-primary" />
                New Alert
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-mono uppercase text-muted-foreground">Alert Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Discord #deals" className="bg-black/20 font-mono text-sm border-border/50" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-mono uppercase text-muted-foreground">Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-black/20 font-mono text-sm border-border/50">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="webhook">Generic Webhook</SelectItem>
                            <SelectItem value="discord">Discord</SelectItem>
                            <SelectItem value="slack">Slack</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-mono uppercase text-muted-foreground">Webhook URL</FormLabel>
                        <FormControl>
                          <Input placeholder="https://..." className="bg-black/20 font-mono text-xs border-border/50" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="minScore"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex justify-between items-center mb-2">
                          <FormLabel className="text-xs font-mono uppercase text-muted-foreground">Min AI Score</FormLabel>
                          <span className="font-mono text-sm text-primary font-bold">{field.value}</span>
                        </div>
                        <FormControl>
                          <Slider
                            min={1}
                            max={10}
                            step={0.5}
                            value={[field.value]}
                            onValueChange={(vals) => field.onChange(vals[0])}
                            className="py-2"
                          />
                        </FormControl>
                        <FormDescription className="text-[10px] font-mono mt-1">
                          Only alert on deals scoring above this threshold.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="enabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border/50 p-3 bg-black/20">
                        <div className="space-y-0.5">
                          <FormLabel className="text-xs font-mono uppercase text-muted-foreground">Active</FormLabel>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full font-mono text-xs tracking-wider" disabled={createAlert.isPending}>
                    {createAlert.isPending ? "CREATING..." : "CREATE ALERT"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card className="bg-secondary/20 border-border/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-mono text-muted-foreground flex items-center gap-2">
                <HelpCircle className="w-4 h-4" />
                Webhook Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-muted-foreground font-mono">
              <div>
                <strong className="text-foreground block mb-1">Discord Webhooks</strong>
                Server Settings -{">"} Integrations -{">"} Webhooks -{">"} New Webhook. Copy the URL and paste it above.
              </div>
              <Separator className="bg-border/30" />
              <div>
                <strong className="text-foreground block mb-1">Slack Webhooks</strong>
                Create a Slack App -{">"} Incoming Webhooks -{">"} Activate -{">"} Add New Webhook to Workspace.
              </div>
              <Separator className="bg-border/30" />
              <div>
                <strong className="text-foreground block mb-1">Generic Webhooks</strong>
                Expects a POST request with a JSON payload containing deal details. Perfect for Zapier, Make, or custom endpoints.
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-8 flex flex-col gap-4">
          {isLoading ? (
            Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-32 w-full bg-card/50" />)
          ) : alerts?.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-border/50 rounded-lg bg-card/20">
              <Terminal className="w-8 h-8 text-muted-foreground mb-4 opacity-50" />
              <h3 className="font-mono text-sm text-foreground mb-1">NO ALERTS CONFIGURED</h3>
              <p className="text-xs text-muted-foreground max-w-sm">
                Create an alert to get notified immediately when high-scoring deals are found by the scanner.
              </p>
            </div>
          ) : (
            alerts?.map((alert: any) => <AlertCard key={alert.id} alert={alert} />)
          )}
        </div>
      </div>
    </Layout>
  );
}
