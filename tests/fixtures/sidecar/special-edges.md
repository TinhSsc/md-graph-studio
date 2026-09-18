# Special Edges Test

Tài liệu thử nghiệm edge mang các thuộc tính khác mặc định, yêu cầu serialize comment tường minh.

## Payment Gateway {#gateway}
Processes payment transactions.

- [[#fraud-service|Check fraud]] <!-- graph-edge: line=dashed; color=red -->
- [[#ledger-service|Sync balance]] <!-- graph-edge: arrow=both -->
- [[#receipt-service]]

## Fraud Service {#fraud-service}
Analyzes transaction risks.

## Ledger Service {#ledger-service}
Double-entry accounting journal.

## Receipt Service {#receipt-service}
Sends confirmation receipts.
