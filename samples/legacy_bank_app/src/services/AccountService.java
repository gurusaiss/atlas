package com.legacybank.services;

import com.legacybank.config.DatabaseConfig;
import com.legacybank.models.Account;

import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

public class AccountService {

    public Account getAccount(Long accountId) throws SQLException {
        try (Connection conn = DatabaseConfig.getConnection();
             Statement stmt = conn.createStatement()) {
            ResultSet rs = stmt.executeQuery("SELECT * FROM accounts WHERE id = " + accountId);
            if (rs.next()) {
                return mapRow(rs);
            }
            return null;
        }
    }

    public List<Account> getAccountsForUser(Long userId) throws SQLException {
        List<Account> accounts = new ArrayList<>();
        try (Connection conn = DatabaseConfig.getConnection();
             Statement stmt = conn.createStatement()) {
            ResultSet rs = stmt.executeQuery("SELECT * FROM accounts WHERE user_id = " + userId);
            while (rs.next()) {
                accounts.add(mapRow(rs));
            }
        }
        return accounts;
    }

    public void updateBalance(Long accountId, BigDecimal newBalance) throws SQLException {
        try (Connection conn = DatabaseConfig.getConnection();
             Statement stmt = conn.createStatement()) {
            stmt.executeUpdate("UPDATE accounts SET balance = " + newBalance + " WHERE id = " + accountId);
        }
    }

    private Account mapRow(ResultSet rs) throws SQLException {
        return new Account(
                rs.getLong("id"),
                rs.getLong("user_id"),
                rs.getString("account_number"),
                rs.getBigDecimal("balance"),
                rs.getString("account_type")
        );
    }
}
