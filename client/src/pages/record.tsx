import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { insertEncounterSchema, type InsertEncounter } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";

export default function Record() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showSuccess, setShowSuccess] = useState(false);

  const form = useForm<InsertEncounter>({
    resolver: zodResolver(insertEncounterSchema),
    defaultValues: {
      name: "",
      location: "",
      datetime: new Date(),
      context: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertEncounter) => {
      return await apiRequest("POST", "/api/encounters", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/encounters"] });
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
      }, 3000);
      form.reset({
        name: "",
        location: "",
        datetime: new Date(),
        context: "",
      });
      toast({
        title: "Encounter saved!",
        description: "Your encounter has been successfully recorded.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save encounter. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertEncounter) => {
    createMutation.mutate(data);
  };

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center space-y-6 animate-in fade-in duration-500">
          <div className="w-20 h-20 mx-auto rounded-full bg-chart-3/10 flex items-center justify-center">
            <CheckCircle className="h-10 w-10 text-chart-3" />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-foreground">Encounter Saved!</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Your encounter has been recorded and is now searchable with AI
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
            <Button
              onClick={() => setShowSuccess(false)}
              data-testid="button-add-another"
            >
              Add Another
            </Button>
            <Button
              variant="outline"
              onClick={() => setLocation("/")}
              data-testid="button-back-home"
            >
              Back to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 sm:py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => setLocation("/")}
            className="gap-2 -ml-3"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Record New Encounter</CardTitle>
            <p className="text-muted-foreground mt-2">
              Save details about someone you've met so you can find them later with AI search
            </p>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., John Doe"
                          {...field}
                          data-testid="input-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Skydeck San Diego"
                          {...field}
                          data-testid="input-location"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="datetime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date & Time *</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          {...field}
                          value={
                            field.value instanceof Date
                              ? field.value.toISOString().slice(0, 16)
                              : field.value
                          }
                          onChange={(e) => field.onChange(new Date(e.target.value))}
                          data-testid="input-datetime"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="context"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Context / Notes (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g., Met after lunch with wife, discussed sailing and tech startups..."
                          className="resize-none min-h-32"
                          {...field}
                          data-testid="input-context"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-3 pt-4">
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={createMutation.isPending}
                    data-testid="button-save"
                  >
                    {createMutation.isPending ? "Saving..." : "Save Encounter"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setLocation("/")}
                    disabled={createMutation.isPending}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
