package com.legacybank.services;

import com.legacybank.config.DatabaseConfig;
import com.legacybank.models.Account;
import com.legacybank.models.Transaction;

import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

public class TransactionService {

    private final AccountService accountService = new AccountService();

    public Transaction transfer(Long fromAccountId, Long toAccountId, BigDecimal amount) throws SQLException {
        Account fromAccount = accountService.getAccount(fromAccountId);
        Account toAccount = accountService.getAccount(toAccountId);

        if (fromAccount == null || toAccount == null) {
            throw new IllegalArgumentException("Invalid account");
        }
        if (fromAccount.getBalance().compareTo(amount) < 0) {
            throw new IllegalStateException("Insufficient funds");
        }

        accountService.updateBalance(fromAccountId, fromAccount.getBalance().subtract(amount));
        accountService.updateBalance(toAccountId, toAccount.getBalance().add(amount));

        return recordTransaction(fromAccountId, toAccountId, amount, "COMPLETED");
    }

    public List<Transaction> getTransactionsForUser(Long userId) throws SQLException {
        List<Transaction> transactions = new ArrayList<>();
        try (Connection conn = DatabaseConfig.getConnection();
             Statement stmt = conn.createStatement()) {
            String query = "SELECT t.* FROM transactions t "
                    + "JOIN accounts a ON t.from_account_id = a.id "
                    + "WHERE a.user_id = " + userId;
            ResultSet rs = stmt.executeQuery(query);
            while (rs.next()) {
                transactions.add(mapRow(rs));
            }
        }
        return transactions;
    }

    private Transaction recordTransaction(Long fromId, Long toId, BigDecimal amount, String status)
            throws SQLException {
        try (Connection conn = DatabaseConfig.getConnection();
             Statement stmt = conn.createStatement()) {
            String query = "INSERT INTO transactions (from_account_id, to_account_id, amount, status) "
                    + "VALUES (" + fromId + ", " + toId + ", " + amount + ", '" + status + "')";
            stmt.executeUpdate(query);
        }
        return new Transaction(null, fromId, toId, amount, status);
    }

    private Transaction mapRow(ResultSet rs) throws SQLException {
        return new Transaction(
                rs.getLong("id"),
                rs.getLong("from_account_id"),
                rs.getLong("to_account_id"),
                rs.getBigDecimal("amount"),
                rs.getString("status")
        );
    }
}
