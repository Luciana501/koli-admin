import React, { useState, useRef, useEffect } from "react";
import { LineChart } from "@mui/x-charts/LineChart";
import { BarChart } from "@mui/x-charts/BarChart";
import { PieChart } from "@mui/x-charts/PieChart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { IconDownload } from "@tabler/icons-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { fetchReportAnalytics, ReportData } from "@/services/firestore";

const dateFormatter = (date: Date) => {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
};

const currencyFormatter = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(value);
};

const Reports = () => {
  const [chartType, setChartType] = useState("users");
  const [timeRange, setTimeRange] = useState("3months");
  const [chartData, setChartData] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(true);
  const reportsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const data = await fetchReportAnalytics(
        chartType as "users" | "donations" | "assets",
        timeRange
      );
      setChartData(data);
      setLoading(false);
    };

    loadData();
  }, [chartType, timeRange]);

  const getChartColor = () => {
    if (chartType === "users") return "#3b82f6";
    if (chartType === "deposits") return "#10b981";
    return "#8b5cf6";
  };

  const getChartLabel = () => {
    if (chartType === "users") return "Users";
    if (chartType === "deposits") return "Deposits";
    return "Total Assets";
  };

  if (loading || chartData.length === 0) {
    return (
      <div className="h-full bg-background p-4 md:p-6 lg:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-muted-foreground mt-1">
            View analytics and statistics
          </p>
        </div>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">
            {loading ? "Loading report data..." : "No data available for the selected time range"}
          </p>
        </div>
      </div>
    );
  }

  const getTimeRangeLabel = () => {
    switch (timeRange) {
      case "7days": return "Last 7 Days";
      case "1month": return "Last Month";
      case "3months": return "Last 3 Months";
      case "6months": return "Last 6 Months";
      case "1year": return "Last Year";
      default: return "Last 3 Months";
    }
  };

  const getDateRangeText = () => {
    if (chartData.length === 0) return "";
    
    const startDate = chartData[0].date;
    const endDate = chartData[chartData.length - 1].date;
    
    const formatDate = (date: Date) => {
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(date);
    };
    
    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  };

  const getChartTypeLabel = () => {
    switch (chartType) {
      case "users": return "User Registrations";
      case "deposits": return "Total Deposits";
      case "assets": return "Total Assets";
      default: return "User Registrations";
    }
  };

  const calculateSummaryStats = () => {
    if (chartData.length === 0) return { total: 0, average: 0, highest: 0, lowest: 0 };
    
    const values = chartData.map(d => chartType === "users" ? (d.count || 0) : (d.amount || 0));
    const total = values[values.length - 1] || 0; // Latest cumulative value
    const average = values.reduce((a, b) => a + b, 0) / values.length;
    const highest = Math.max(...values);
    const lowest = Math.min(...values);
    
    return { total, average, highest, lowest };
  };

  const handleExportPDF = async () => {
    if (!reportsRef.current) return;

    try {
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pageWidth - (margin * 2);
      let yPosition = margin;

      // Header
      pdf.setFillColor(59, 130, 246); // Primary blue
      pdf.rect(0, 0, pageWidth, 35, "F");
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(24);
      pdf.setFont("helvetica", "bold");
      pdf.text("KOLI ADMIN", margin, 15);
      
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "normal");
      pdf.text("Analytics Report", margin, 24);
      
      // Date and time range on the right
      const currentDate = new Date().toLocaleDateString("en-US", { 
        year: "numeric", 
        month: "long", 
        day: "numeric" 
      });
      pdf.setFontSize(10);
      pdf.text(currentDate, pageWidth - margin, 15, { align: "right" });
      pdf.text(getTimeRangeLabel(), pageWidth - margin, 24, { align: "right" });
      
      // Add actual date range if available
      if (chartData.length > 0) {
        pdf.setFontSize(8);
        pdf.text(getDateRangeText(), pageWidth - margin, 30, { align: "right" });
      }

      yPosition = 45;

      // Report Title
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.text(getChartTypeLabel() + " Analysis", margin, yPosition);
      yPosition += 10;

      // Summary Statistics
      const stats = calculateSummaryStats();
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(100, 100, 100);
      pdf.text("Report Summary", margin, yPosition);
      yPosition += 2;
      
      pdf.setLineWidth(0.5);
      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 8;

      // Stats boxes
      pdf.setFontSize(9);
      pdf.setTextColor(0, 0, 0);
      const boxWidth = (contentWidth - 10) / 4;
      const boxHeight = 20;
      
      const statsData = [
        { label: "Current Total", value: chartType === "users" ? stats.total.toString() : currencyFormatter(stats.total) },
        { label: "Average", value: chartType === "users" ? Math.round(stats.average).toString() : currencyFormatter(stats.average) },
        { label: "Highest", value: chartType === "users" ? stats.highest.toString() : currencyFormatter(stats.highest) },
        { label: "Data Points", value: chartData.length.toString() },
      ];

      statsData.forEach((stat, index) => {
        const x = margin + (boxWidth + 2.5) * index;
        
        pdf.setFillColor(245, 247, 250);
        pdf.roundedRect(x, yPosition, boxWidth, boxHeight, 2, 2, "F");
        
        pdf.setDrawColor(220, 220, 220);
        pdf.setLineWidth(0.3);
        pdf.roundedRect(x, yPosition, boxWidth, boxHeight, 2, 2, "S");
        
        pdf.setFontSize(8);
        pdf.setTextColor(100, 100, 100);
        pdf.text(stat.label, x + boxWidth / 2, yPosition + 6, { align: "center" });
        
        pdf.setFontSize(11);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(0, 0, 0);
        pdf.text(stat.value, x + boxWidth / 2, yPosition + 14, { align: "center" });
      });

      yPosition += boxHeight + 12;

      // Chart description
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(80, 80, 80);
      const description = `This report shows ${getChartTypeLabel().toLowerCase()} over ${getTimeRangeLabel().toLowerCase()}. ` +
        `The data visualizations below provide a comprehensive overview of trends and patterns.`;
      const splitDescription = pdf.splitTextToSize(description, contentWidth);
      pdf.text(splitDescription, margin, yPosition);
      yPosition += (splitDescription.length * 4) + 8;

      // Capture charts as image
      const canvas = await html2canvas(reportsRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");
      const imgWidth = contentWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      // Check if we need a new page
      if (yPosition + imgHeight > pageHeight - margin - 20) {
        pdf.addPage();
        yPosition = margin;
      }

      pdf.addImage(imgData, "PNG", margin, yPosition, imgWidth, imgHeight);
      yPosition += imgHeight + 10;

      // Footer
      const footerY = pageHeight - 10;
      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      pdf.setFont("helvetica", "italic");
      pdf.text("Generated by KOLI Admin System", margin, footerY);
      pdf.text(`Page 1 of 1`, pageWidth - margin, footerY, { align: "right" });

      pdf.save(`KOLI-Report-${getChartTypeLabel().replace(/\s/g, "-")}-${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
    }
  };

  return (
    <div className="h-full bg-background p-4 md:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-muted-foreground mt-1">
            View analytics and statistics
          </p>
          {chartData.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              📅 Data Range: {getDateRangeText()}
            </p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={handleExportPDF}
            variant="outline"
            className="gap-2 w-full sm:w-auto"
            disabled={loading || chartData.length === 0}
          >
            <IconDownload className="h-4 w-4" />
            Export PDF ({getTimeRangeLabel()})
          </Button>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7days">Last 7 days</SelectItem>
              <SelectItem value="1month">Last month</SelectItem>
              <SelectItem value="3months">Last 3 months</SelectItem>
              <SelectItem value="6months">Last 6 months</SelectItem>
              <SelectItem value="1year">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Select value={chartType} onValueChange={setChartType}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Select statistic" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="users">User Registrations</SelectItem>
              <SelectItem value="deposits">Total Deposits</SelectItem>
              <SelectItem value="assets">Total Assets</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div ref={reportsRef} className="space-y-6">
        {/* Line Chart */}
        <div className="bg-card border border-border rounded-lg p-4 md:p-6">
          <h2 className="text-base md:text-lg font-semibold mb-4">Line Chart</h2>
          <div className="w-full bg-card overflow-x-auto" style={{ minHeight: '300px' }}>
            <div style={{ background: 'hsl(var(--card))', width: '100%', height: '100%', minWidth: '600px' }}>
              <LineChart
                dataset={chartData as any}
                xAxis={[
                  {
                    dataKey: "date",
                    scaleType: "time",
                    valueFormatter: dateFormatter,
                  },
                ]}
                yAxis={
                  chartType === "users"
                    ? undefined
                    : [{ valueFormatter: currencyFormatter }]
                }
                series={[
                  {
                    dataKey: chartType === "users" ? "count" : "amount",
                    label: getChartLabel(),
                    showMark: true,
                    color: getChartColor(),
                    valueFormatter: (value) =>
                      chartType === "users" ? String(value) : currencyFormatter(value as number),
                  },
                ]}
                height={300}
                grid={{ vertical: true, horizontal: true }}
                margin={{
                  left: chartType === "users" ? 50 : 80,
                  right: 20,
                  top: 20,
                  bottom: 30,
                }}
              />
            </div>
          </div>
        </div>

        {/* Bar Chart */}
        <div className="bg-card border border-border rounded-lg p-4 md:p-6">
          <h2 className="text-base md:text-lg font-semibold mb-4">Bar Chart</h2>
          <div className="w-full bg-card overflow-x-auto" style={{ minHeight: '300px' }}>
            <div style={{ background: 'hsl(var(--card))', width: '100%', height: '100%', minWidth: '600px' }}>
              <BarChart
                xAxis={[
                  {
                    data: chartData.map((d) => dateFormatter(d.date)),
                    scaleType: "band",
                  },
                ]}
                yAxis={
                  chartType === "users"
                    ? undefined
                    : [{ valueFormatter: currencyFormatter }]
                }
                series={[
                  {
                    data: chartData.map((d) =>
                      chartType === "users" ? (d.count || 0) : (d.amount || 0)
                    ),
                    label: getChartLabel(),
                    color: getChartColor(),
                    valueFormatter: (value) =>
                      chartType === "users" ? String(value) : currencyFormatter(value as number),
                  },
                ]}
                height={300}
                margin={{
                  left: chartType === "users" ? 50 : 80,
                  right: 20,
                  top: 20,
                  bottom: 30,
                }}
              />
            </div>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="bg-card border border-border rounded-lg p-4 md:p-6">
          <h2 className="text-base md:text-lg font-semibold mb-4">Pie Chart</h2>
          <div className="w-full flex justify-center bg-card overflow-x-auto" style={{ minHeight: '300px' }}>
            <div style={{ background: 'hsl(var(--card))', width: '100%', height: '100%', display: 'flex', justifyContent: 'center', minWidth: '400px' }}>
              <PieChart
              series={[
                {
                  data: chartData.map((d, idx) => ({
                    id: idx,
                    value: chartType === "users" ? (d.count || 0) : (d.amount || 0),
                    label: dateFormatter(d.date),
                  })),
                  valueFormatter: (item) => 
                    chartType === "users"
                      ? String(item.value)
                      : currencyFormatter(item.value),
                },
              ]}
              width={600}
              height={300}
            />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
