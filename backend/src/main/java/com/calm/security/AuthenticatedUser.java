package com.calm.security;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.security.Principal;
import java.util.Collection;
import java.util.List;

/** Принципал, который кладётся в SecurityContext после валидации JWT. */
public class AuthenticatedUser implements Principal {

    private final String userId;
    private final String email;
    private final String role;
    private final Collection<GrantedAuthority> authorities;

    public AuthenticatedUser(String userId, String email, String role) {
        this.userId = userId;
        this.email  = email;
        this.role   = role == null || role.isBlank() ? "USER" : role;
        this.authorities = List.of(new SimpleGrantedAuthority("ROLE_" + this.role));
    }

    public String getUserId() { return userId; }
    public String getEmail()  { return email; }
    public String getRole()   { return role; }

    public Collection<GrantedAuthority> getAuthorities() { return authorities; }

    @Override
    public String getName() { return email; }
}
