// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { LoginPage } from "../pages/LoginPage.tsx";
import * as AuthContextModule from "../context/AuthContext.tsx";

vi.mock("../context/AuthContext.tsx", () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockUseAuth = vi.mocked(AuthContextModule.useAuth);

function renderLogin(initialPath = "/login") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/setup" element={<div>Setup Page</div>} />
        <Route path="/vehicles" element={<div>Vehicles Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      setupNeeded: false,
      login: vi.fn(),
      logout: vi.fn(),
      completeSetup: vi.fn(),
    });
  });

  it("renders username and password fields", () => {
    renderLogin();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it("renders a sign in button", () => {
    renderLogin();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("redirects to /setup when setupNeeded is true", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      setupNeeded: true,
      login: vi.fn(),
      logout: vi.fn(),
      completeSetup: vi.fn(),
    });
    renderLogin();
    expect(screen.getByText("Setup Page")).toBeInTheDocument();
  });

  it("redirects to /vehicles when already logged in", () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: "alice", role: "admin" },
      loading: false,
      setupNeeded: false,
      login: vi.fn(),
      logout: vi.fn(),
      completeSetup: vi.fn(),
    });
    renderLogin();
    expect(screen.getByText("Vehicles Page")).toBeInTheDocument();
  });

  it("renders nothing while loading", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: true,
      setupNeeded: false,
      login: vi.fn(),
      logout: vi.fn(),
      completeSetup: vi.fn(),
    });
    const { container } = renderLogin();
    expect(container).toBeEmptyDOMElement();
  });

  it("calls login with the entered credentials", async () => {
    const user = userEvent.setup();
    const loginFn = vi.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      setupNeeded: false,
      login: loginFn,
      logout: vi.fn(),
      completeSetup: vi.fn(),
    });

    renderLogin();
    await user.type(screen.getByLabelText(/username/i), "alice");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(loginFn).toHaveBeenCalledWith("alice", "password123"));
  });

  it("displays an error message when login fails", async () => {
    const user = userEvent.setup();
    const loginFn = vi.fn().mockRejectedValue(new Error("Invalid username or password"));
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      setupNeeded: false,
      login: loginFn,
      logout: vi.fn(),
      completeSetup: vi.fn(),
    });

    renderLogin();
    await user.type(screen.getByLabelText(/username/i), "alice");
    await user.type(screen.getByLabelText(/password/i), "wrongpassword");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() =>
      expect(screen.getByText(/invalid username or password/i)).toBeInTheDocument()
    );
  });

  it("disables the button while sign-in is pending", async () => {
    const user = userEvent.setup();
    let resolveFn: () => void;
    const loginFn = vi.fn().mockReturnValue(new Promise<void>((r) => { resolveFn = r; }));
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      setupNeeded: false,
      login: loginFn,
      logout: vi.fn(),
      completeSetup: vi.fn(),
    });

    renderLogin();
    await user.type(screen.getByLabelText(/username/i), "alice");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(screen.getByRole("button", { name: /signing in/i })).toBeDisabled();
    resolveFn!();
  });
});
