import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, Users, CheckCircle, Clock } from "lucide-react";
import { Redirect } from "wouter";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";

export default function AdminPage() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [cashbackAmounts, setCashbackAmounts] = useState<Record<number, number>>({});
  const [coupons, setCoupons] = useState<Array<{ purchaseId: number; couponCode: string }>>([]); // Added state for coupons

  const { data: users, isLoading: loadingUsers } = useQuery({
    queryKey: ["/api/users"],
  });

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ["/api/stats"],
  });

  const { data: purchases, isLoading: loadingPurchases } = useQuery({
    queryKey: ["/api/purchases"],
    select: (data) => {
      return [...data].sort((a, b) => {
        if (a.verificationStatus === b.verificationStatus) {
          return new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime();
        }
        return a.verificationStatus === "pending" ? -1 : 1;
      });
    },
  });

  const { data: fetchedCoupons } = useQuery({ // Added query for coupons
    queryKey: ["/api/coupons"],
  });

  const verifyPurchaseMutation = useMutation({
    mutationFn: async (purchaseId: number) => {
      const res = await apiRequest("POST", `/api/purchases/${purchaseId}/verify`, {
        cashbackAmount: cashbackAmounts[purchaseId]
      });
      const data = await res.json();
      setCoupons([...coupons, {purchaseId, couponCode: data.couponCode}]); // Update coupons state
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"] });
      toast({
        title: "Purchase verified",
        description: "Cashback coupon has been generated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Verification failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (purchases) {
      const newCashbackAmounts = { ...cashbackAmounts };
      purchases.forEach((purchase) => {
        if (!newCashbackAmounts[purchase.id]) {
          newCashbackAmounts[purchase.id] = Number(purchase.billAmount) * 0.04;
        }
      });
      setCashbackAmounts(newCashbackAmounts);
    }
  }, [purchases]);

  useEffect(() => {
    // Update the coupons state when fetchedCoupons changes
    if (fetchedCoupons) {
      setCoupons(fetchedCoupons);
    }
  }, [fetchedCoupons]);


  if (!user?.isAdmin) {
    return <Redirect to="/" />;
  }

  const pendingCount = purchases?.filter(p => p.verificationStatus === "pending").length || 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            Admin Dashboard
          </h1>
          <Button
            variant="ghost"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
          >
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loadingStats ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <div className="text-2xl font-bold">{stats?.userCount}</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Verifications</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-500">{pendingCount}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Purchase Verifications</CardTitle>
              <CardDescription>Review and verify customer purchase submissions. Pending verifications are shown first.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingPurchases ? (
                <div className="flex justify-center p-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bill Number</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Purchase Date</TableHead>
                      <TableHead>Submission Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchases?.map((purchase) => {
                      const customer = users?.find(u => u.id === purchase.userId);
                      const isPending = purchase.verificationStatus === "pending";
                      return (
                        <TableRow
                          key={purchase.id}
                          className={isPending ? "bg-orange-50" : ""}
                        >
                          <TableCell className="font-medium">{purchase.billNumber}</TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{customer?.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {customer?.phone}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>₹{purchase.billAmount}</TableCell>
                          <TableCell>
                            {format(new Date(purchase.purchaseDate), "PPP")}
                          </TableCell>
                          <TableCell>
                            {format(new Date(purchase.createdAt), "PPP")}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {isPending ? (
                                <Clock className="h-4 w-4 text-orange-500" />
                              ) : (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              )}
                              <span
                                className={`px-2 py-1 text-xs rounded-full ${
                                  isPending
                                    ? "bg-orange-100 text-orange-800"
                                    : "bg-green-100 text-green-800"
                                }`}
                              >
                                {purchase.verificationStatus}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {isPending && (
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    const calculatedAmount = Number(purchase.billAmount) * 0.04;
                                    setCashbackAmounts({
                                      ...cashbackAmounts,
                                      [purchase.id]: calculatedAmount,
                                    });
                                    verifyPurchaseMutation.mutate(purchase.id);
                                  }}
                                  disabled={verifyPurchaseMutation.isPending}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  {verifyPurchaseMutation.isPending && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  )}
                                  Verify Purchase
                                </Button>
                              </div>
                            )}
                            {!isPending && (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">Cashback Amount:</span>
                                  <span className="font-mono">₹{cashbackAmounts[purchase.id]?.toFixed(2)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">Voucher Code:</span>
                                  <span className="font-mono text-primary">{
                                    coupons?.find(c => c.purchaseId === purchase.id)?.couponCode
                                  }</span>
                                </div>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {!purchases?.length && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-4">
                          No purchases to verify
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Users</CardTitle>
              <CardDescription>A list of all registered users.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingUsers ? (
                <div className="flex justify-center p-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Address</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users?.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>{user.username}</TableCell>
                        <TableCell>{user.name}</TableCell>
                        <TableCell>{user.phone}</TableCell>
                        <TableCell>{user.address}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}