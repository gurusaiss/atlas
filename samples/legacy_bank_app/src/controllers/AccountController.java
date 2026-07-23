package com.legacybank.controllers;

import com.legacybank.models.Account;
import com.legacybank.services.AccountService;

import java.sql.SQLException;
import java.util.List;

public class AccountController {

    private final AccountService accountService = new AccountService();

    public Account getAccount(Long accountId) throws SQLException {
        return accountService.getAccount(accountId);
    }

    public List<Account> getAccountsForUser(Long userId) throws SQLException {
        return accountService.getAccountsForUser(userId);
    }
}
