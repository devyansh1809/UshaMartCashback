import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertPurchaseSchema, type InsertPurchase } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function HomePage() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();

  const form = useForm<InsertPurchase>({
    resolver: zodResolver(insertPurchaseSchema),
    defaultValues: {
      billNumber: "",
      billAmount: 0,
      purchaseDate: new Date(),
    },
  });

  const purchaseMutation = useMutation({
    mutationFn: async (data: InsertPurchase) => {
      const res = await apiRequest("POST", "/api/purchases", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/coupons"] });
      form.reset();
      toast({
        title: "Purchase submitted",
        description: "Your purchase has been recorded and is pending verification.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Submission failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const { data: purchases } = useQuery({
    queryKey: ["/api/purchases"],
  });

  const { data: coupons } = useQuery({
    queryKey: ["/api/coupons"],
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            USHA MART
          </h1>
          <div className="flex items-center gap-4">
            {user?.isAdmin && (
              <Link href="/admin">
                <Button variant="outline">Admin Dashboard</Button>
              </Link>
            )}
            <Button
              variant="ghost"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Submit Purchase for Cashback</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={form.handleSubmit((data) => {
                  purchaseMutation.mutate({
                    ...data,
                    billAmount: Number(data.billAmount),
                  });
                })}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="billNumber">Bill Number</Label>
                  <Input
                    id="billNumber"
                    {...form.register("billNumber")}
                    placeholder="Enter bill number"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="billAmount">Bill Amount</Label>
                  <Input
                    id="billAmount"
                    type="number"
                    step="0.01"
                    {...form.register("billAmount", { valueAsNumber: true })}
                    placeholder="Enter bill amount"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="purchaseDate">Purchase Date</Label>
                  <Input
                    id="purchaseDate"
                    type="date"
                    {...form.register("purchaseDate", {
                      valueAsDate: true,
                    })}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={purchaseMutation.isPending}
                >
                  {purchaseMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Submit Purchase
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Your Purchases</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {purchases?.map((purchase) => (
                    <div
                      key={purchase.id}
                      className="flex justify-between items-center p-4 border rounded"
                    >
                      <div>
                        <p className="font-medium">Bill #{purchase.billNumber}</p>
                        <p className="text-sm text-muted-foreground">
                          Amount: ₹{purchase.billAmount}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Date: {format(new Date(purchase.purchaseDate), "PPP")}
                        </p>
                      </div>
                      <div>
                        <span
                          className={`px-2 py-1 text-xs rounded ${
                            purchase.verificationStatus === "verified"
                              ? "bg-green-100 text-green-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {purchase.verificationStatus}
                        </span>
                      </div>
                    </div>
                  ))}
                  {!purchases?.length && (
                    <p className="text-muted-foreground text-center py-4">
                      No purchases submitted yet
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Your Cashback Coupons</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {coupons?.map((coupon) => (
                    <div
                      key={coupon.id}
                      className="p-4 border rounded bg-primary/5"
                    >
                      <p className="font-mono text-lg font-bold">
                        {coupon.couponCode}
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Amount: ₹{coupon.amount}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Generated:{" "}
                        {format(new Date(coupon.createdAt), "PPP")}
                      </p>
                    </div>
                  ))}
                  {!coupons?.length && (
                    <p className="text-muted-foreground text-center py-4">
                      No cashback coupons yet
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}