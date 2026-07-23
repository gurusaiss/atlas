package com.legacybank.controllers;

import com.legacybank.models.User;
import com.legacybank.services.UserService;

import java.sql.SQLException;

/**
 * REST endpoints for user registration/authentication.
 * (Framework annotations omitted -- this sample models the request-handling
 * shape without pulling in the full Spring dependency tree.)
 */
public class UserController {

    private final UserService userService = new UserService();

    public User login(String username, String password) throws SQLException {
        User user = userService.authenticate(username, password);
        if (user == null) {
            throw new SecurityException("Invalid credentials");
        }
        return user;
    }

    public User register(String username, String email, String password) throws SQLException {
        return userService.register(username, email, password);
    }

    public User getProfile(Long userId) throws SQLException {
        return userService.getById(userId);
    }
}
