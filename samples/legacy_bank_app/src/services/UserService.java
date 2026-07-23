package com.legacybank.services;

import com.legacybank.models.User;
import com.legacybank.repository.UserRepository;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.SQLException;

public class UserService {

    private final UserRepository userRepository = new UserRepository();

    public User authenticate(String username, String password) throws SQLException {
        User user = userRepository.findByUsername(username);
        if (user == null) {
            return null;
        }
        String hashed = hashPassword(password);
        if (hashed.equals(user.getPasswordHash())) {
            return user;
        }
        return null;
    }

    public User register(String username, String email, String password) throws SQLException {
        User user = new User(null, username, email, hashPassword(password), "customer");
        userRepository.save(user);
        return user;
    }

    private String hashPassword(String password) {
        try {
            // VULNERABILITY 4: weak cryptographic hash (OWASP A02 - Cryptographic Failures).
            // MD5 has been broken for password hashing for over a decade; this should be
            // bcrypt/scrypt/argon2 with a per-user salt.
            MessageDigest md = MessageDigest.getInstance("MD5");
            byte[] digest = md.digest(password.getBytes());
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("MD5 not available", e);
        }
    }

    public User getById(Long id) throws SQLException {
        return userRepository.findById(id);
    }
}
