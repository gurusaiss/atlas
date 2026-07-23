package com.legacybank.config;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

public class DatabaseConfig {

    private static final String URL = "jdbc:mysql://localhost:3306/legacybank";
    private static final String USERNAME = "root";
    // VULNERABILITY 2: hardcoded password (OWASP A02 - Cryptographic Failures / secrets in source)
    private static final String PASSWORD = "admin123";

    public static Connection getConnection() throws SQLException {
        try {
            Class.forName("com.mysql.cj.jdbc.Driver");
        } catch (ClassNotFoundException e) {
            throw new SQLException("MySQL driver not found", e);
        }
        // NOTE: no SSL/TLS parameters on this connection string -- HTTPS/TLS enforcement
        // was never added when this service was migrated off the mainframe.
        return DriverManager.getConnection(URL, USERNAME, PASSWORD);
    }
}
