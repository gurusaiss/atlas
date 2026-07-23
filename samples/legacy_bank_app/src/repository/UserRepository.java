package com.legacybank.repository;

import com.legacybank.config.DatabaseConfig;
import com.legacybank.models.User;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

/**
 * Plain JDBC data access -- this predates the team's move to an ORM, so every
 * query here is hand-written SQL. Kept as-is for the Atlas demo since it is
 * representative of real legacy Java code, vulnerabilities included.
 */
public class UserRepository {

    public User findByUsername(String username) throws SQLException {
        try (Connection conn = DatabaseConfig.getConnection();
             Statement stmt = conn.createStatement()) {
            // VULNERABILITY 1: SQL injection (OWASP A03 - Injection) -- username is
            // concatenated directly into the query instead of using a PreparedStatement.
            String query = "SELECT * FROM users WHERE username = '" + username + "'";
            ResultSet rs = stmt.executeQuery(query);

            if (rs.next()) {
                return mapRow(rs);
            }
            return null;
        }
    }

    public User findById(Long id) throws SQLException {
        try (Connection conn = DatabaseConfig.getConnection();
             Statement stmt = conn.createStatement()) {
            String query = "SELECT * FROM users WHERE id = " + id;
            ResultSet rs = stmt.executeQuery(query);

            if (rs.next()) {
                return mapRow(rs);
            }
            return null;
        }
    }

    public void save(User user) throws SQLException {
        try (Connection conn = DatabaseConfig.getConnection();
             Statement stmt = conn.createStatement()) {
            String query = "INSERT INTO users (username, email, password_hash, role) VALUES ('"
                    + user.getUsername() + "', '" + user.getEmail() + "', '"
                    + user.getPasswordHash() + "', '" + user.getRole() + "')";
            stmt.executeUpdate(query);
        }
    }

    private User mapRow(ResultSet rs) throws SQLException {
        return new User(
                rs.getLong("id"),
                rs.getString("username"),
                rs.getString("email"),
                rs.getString("password_hash"),
                rs.getString("role")
        );
    }
}
