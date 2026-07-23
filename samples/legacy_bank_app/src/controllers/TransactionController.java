package com.legacybank.controllers;

import com.legacybank.models.Transaction;
import com.legacybank.services.TransactionService;

import java.math.BigDecimal;
import java.sql.SQLException;
import java.util.List;

public class TransactionController {

    private final TransactionService transactionService = new TransactionService();

    public Transaction transfer(Long fromAccountId, Long toAccountId, BigDecimal amount) throws SQLException {
        return transactionService.transfer(fromAccountId, toAccountId, amount);
    }

    // VULNERABILITY 3: broken access control (OWASP A01) -- this endpoint returns any
    // user's transaction history given their ID, with no check that the caller (the
    // currently authenticated session) actually owns that userId. Classic IDOR.
    public List<Transaction> getAllTransactions(Long userId) throws SQLException {
        return transactionService.getTransactionsForUser(userId);
    }
}
