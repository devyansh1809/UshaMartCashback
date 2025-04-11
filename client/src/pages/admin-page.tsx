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
import { Loader2, Users, CheckCircle, Clock, RefreshCw } from "lucide-react";
import { Redirect } from "wouter";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";


export default function AdminPage() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [cashbackAmounts, setCashbackAmounts] = useState<Record<number, number>>({});
  const [coupons, setCoupons] = useState<Array<{ purchaseId: number; couponCode: string }>>([]);
  const [allCoupons, setAllCoupons] = useState<Array<{ purchaseId: number; couponCode: string; billNumber: string; billAmount: number; amount: number; createdAt: string }>>([]);
  const [redeemedCoupons, setRedeemedCoupons] = useState<Array<{ purchaseId: number; couponCode: string; billNumber: string; billAmount: number; amount: number; createdAt: string }>>([]);
  const [searchQuery, setSearchQuery] = useState(''); // Added search state


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

  const { data: fetchedCoupons } = useQuery({
    queryKey: ["/api/purchases"],
    select: (data) => {
      return data
        .filter(p => p.verificationStatus === "verified")
        .map(p => ({
          purchaseId: p.id,
          couponCode: p.couponCode
        }))
        .filter(c => c.couponCode);
    },
  });

  const verifyPurchaseMutation = useMutation({
    mutationFn: async (purchaseId: number) => {
      const res = await apiRequest("POST", `/api/purchases/${purchaseId}/verify`, {
        cashbackAmount: cashbackAmounts[purchaseId],
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/coupons"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/coupons"] });
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

  const redeemCouponMutation = useMutation({
    mutationFn: async (purchaseId: number) => {
      const res = await apiRequest("POST", `/api/coupons/${purchaseId}/redeem`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/coupons"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/coupons"] });
      toast({
        title: "Coupon redeemed",
        description: `Coupon for Bill #${data.billNumber} has been redeemed successfully.`,
      });

      // Refetch coupons to update the displayed values
      refetchCoupons();
    },
    onError: (error: Error) => {
      toast({
        title: "Redemption failed",
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
    if (fetchedCoupons) {
      setCoupons(fetchedCoupons);
    }
  }, [fetchedCoupons]);

  const refetchCoupons = async () => {
    // Use admin endpoint to get all coupons with purchase data
    const res = await apiRequest("GET", "/api/admin/coupons");
    const data = await res.json();

    // Get all coupons from storage to find amounts
    const couponRes = await apiRequest("GET", "/api/coupons");
    let allCoupons = await couponRes.json();

    // Fetch all purchases to get the correct data
    const purchaseRes = await apiRequest("GET", "/api/purchases");
    const purchases = await purchaseRes.json();

    // Map purchases to coupons based on purchase ID
    const couponMap = {};
    for (const coupon of allCoupons) {
      couponMap[coupon.purchaseId] = coupon;
    }

    // Create enhanced data with all necessary info
    const enhancedData = data.map((purchaseWithCoupon) => {
      // Find this purchase in all purchases
      const purchase = purchases.find(p => p.id === purchaseWithCoupon.id);

      // Find the coupon for this purchase
      const couponDetail = Object.values(couponMap).find(c => c.purchaseId === purchaseWithCoupon.id);

      return {
        purchaseId: purchaseWithCoupon.id,
        couponCode: purchaseWithCoupon.couponCode,
        billNumber: purchaseWithCoupon.billNumber || purchase?.billNumber,
        billAmount: purchaseWithCoupon.billAmount || purchase?.billAmount,
        amount: couponDetail?.amount || cashbackAmounts[purchaseWithCoupon.id] || "0", // Use the coupon amount or cashback amount
        createdAt: couponDetail?.createdAt || new Date().toISOString(),
        status: couponDetail?.status || 'active'
      };
    });

    // Filter active vs redeemed coupons
    const active = enhancedData.filter(c => c.status !== 'redeemed');
    const redeemed = enhancedData.filter(c => c.status === 'redeemed');

    setAllCoupons(active);
    setRedeemedCoupons(redeemed);
  }

  useEffect(() => {
    refetchCoupons();
  }, []);

  // Refresh vouchers when verifying a purchase
  useEffect(() => {
    if (verifyPurchaseMutation.isSuccess) {
      refetchCoupons();
    }
  }, [verifyPurchaseMutation.isSuccess]);


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

          <Tabs defaultValue="purchases" className="mt-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="purchases">Customer Purchases</TabsTrigger>
              <TabsTrigger value="vouchers">Voucher Codes</TabsTrigger>
              <TabsTrigger value="redeemed">Redeemed Coupons</TabsTrigger>
            </TabsList>

            <TabsContent value="purchases">
              <Card>
                <CardHeader>
                  <CardTitle>Customer Purchases</CardTitle>
                  <div className="mt-2">
                    <input
                      type="text"
                      placeholder="Search by bill number..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingPurchases ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Bill #</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {purchases?.filter(purchase => !searchQuery || purchase.billNumber.toLowerCase().includes(searchQuery.toLowerCase())).map((purchase) => { // Added search filter
                          const user = users?.find((u) => u.id === purchase.userId);
                          const isPending =
                            purchase.verificationStatus === "pending";
                          return (
                            <TableRow key={purchase.id}>
                              <TableCell className="font-medium">
                                {purchase.billNumber}
                              </TableCell>
                              <TableCell>{user?.name}</TableCell>
                              <TableCell>₹{purchase.billAmount}</TableCell>
                              <TableCell>
                                {format(new Date(purchase.purchaseDate), "PPP")}
                              </TableCell>
                              <TableCell>
                                <span
                                  className={`px-2 py-1 text-xs rounded ${
                                    isPending
                                      ? "bg-yellow-100 text-yellow-800"
                                      : "bg-green-100 text-green-800"
                                  }`}
                                >
                                  {purchase.verificationStatus}
                                </span>
                              </TableCell>
                              <TableCell>
                                {isPending && (
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      verifyPurchaseMutation.mutate(purchase.id)
                                    }
                                    disabled={verifyPurchaseMutation.isPending}
                                    className="bg-primary hover:bg-primary/90"
                                  >
                                    {verifyPurchaseMutation.isPending && (
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    )}
                                    Verify & Generate Cashback
                                  </Button>
                                )}
                                {!isPending && (
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium">Cashback Amount:</span>
                                      <Input
                                        type="number"
                                        value={cashbackAmounts[purchase.id] || 0}
                                        onChange={(e) => {
                                          const newAmount = Number(e.target.value);
                                          setCashbackAmounts({
                                            ...cashbackAmounts,
                                            [purchase.id]: newAmount,
                                          });
                                        }}
                                        className="w-24"
                                        step="0.01"
                                      />
                                      <Button
                                        size="sm"
                                        onClick={() => verifyPurchaseMutation.mutate(purchase.id)}
                                        disabled={verifyPurchaseMutation.isPending}
                                        className="bg-primary hover:bg-primary/90"
                                      >
                                        {verifyPurchaseMutation.isPending &&
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        }
                                        Update Cashback
                                      </Button>
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
            </TabsContent>

            <TabsContent value="vouchers">
              <Card>
                <CardHeader>
                  <CardTitle>Voucher Codes</CardTitle>
                  <div className="mt-2">
                    <input
                      type="text"
                      placeholder="Search by bill number..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Coupon Code</TableHead>
                        <TableHead>Bill Number</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Purchase Amount</TableHead>
                        <TableHead>Voucher Value</TableHead>
                        <TableHead>Created Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allCoupons?.filter(coupon => !searchQuery || coupon.billNumber.toLowerCase().includes(searchQuery.toLowerCase())).map((coupon) => {
                        const purchase = purchases?.find(p => p.id === coupon.purchaseId);
                        const user = users?.find(u => u.id === purchase?.userId);

                        return (
                          <TableRow key={coupon.couponCode}>
                            <TableCell className="font-mono font-medium text-primary">
                              {coupon.couponCode}
                            </TableCell>
                            <TableCell>{coupon.billNumber}</TableCell>
                            <TableCell>{user?.name}</TableCell>
                            <TableCell>₹{purchase?.billAmount}</TableCell>
                            <TableCell className="font-medium">₹{coupon.amount}</TableCell>
                            <TableCell>{format(new Date(coupon.createdAt), "PPP")}</TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                onClick={() => redeemCouponMutation.mutate(coupon.purchaseId)}
                                disabled={redeemCouponMutation.isPending}
                                className="bg-primary hover:bg-primary/90"
                              >
                                {redeemCouponMutation.isPending &&
                                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                }
                                Redeem
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {!allCoupons?.length && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-4 text-muted-foreground">
                            No voucher codes generated yet
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                      );
                    })}

                    {!allCoupons?.length && (
                      <div className="col-span-full text-center py-8 text-muted-foreground">
                        No voucher codes generated yet
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="redeemed">
              <Card>
                <CardHeader>
                  <CardTitle>Redeemed Coupons</CardTitle>
                  <div className="mt-2">
                    <input
                      type="text"
                      placeholder="Search by bill number..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Coupon Code</TableHead>
                        <TableHead>Bill Number</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Purchase Amount</TableHead>
                        <TableHead>Voucher Value</TableHead>
                        <TableHead>Created Date</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {redeemedCoupons?.filter(coupon => !searchQuery || coupon.billNumber.toLowerCase().includes(searchQuery.toLowerCase())).map((coupon) => {
                        const purchase = purchases?.find(p => p.id === coupon.purchaseId);
                        const user = users?.find(u => u.id === purchase?.userId);

                        return (
                          <TableRow key={coupon.couponCode} className="bg-muted/10">
                            <TableCell className="font-mono font-medium">
                              {coupon.couponCode}
                            </TableCell>
                            <TableCell>{coupon.billNumber}</TableCell>
                            <TableCell>{user?.name || "Unknown"}</TableCell>
                            <TableCell>₹{purchase?.billAmount}</TableCell>
                            <TableCell className="font-medium">₹{coupon.amount}</TableCell>
                            <TableCell>{format(new Date(coupon.createdAt), "PPP")}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-rose-100 text-rose-600 border-rose-200">
                                Redeemed
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {!redeemedCoupons?.length && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-4 text-muted-foreground">
                            No redeemed coupons yet
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                      );
                    })}

                    {!redeemedCoupons?.length && (
                      <div className="col-span-full text-center py-8 text-muted-foreground">
                        No redeemed coupons yet
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

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