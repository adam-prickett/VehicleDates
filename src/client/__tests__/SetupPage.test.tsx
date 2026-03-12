// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { SetupPage } from "../pages/SetupPage.tsx";
import * as AuthContextModule from "../context/AuthContext.tsx";

vi.mock("../context/AuthContext.tsx", () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockUseAuth = vi.mocked(AuthContextModule.useAuth);

function renderSetup() {
  return render(
    <MemoryRouter initialEntries={["/setup"]}>
      <Routes>
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/vehicles" element={<div>Vehicles Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("SetupPage", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      setupNeeded: true,
      login: vi.fn(),
      logout: vi.fn(),
      completeSetup: vi.fn(),
    });
  });

  it("renders the setup form when setupNeeded is true", () => {
    renderSetup();
    expect(screen.getByLabelText(/^username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
  });

  it("redirects to /login when setup is not needed", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      setupNeeded: false,
      login: vi.fn(),
      logout: vi.fn(),
      completeSetup: vi.fn(),
    });
    renderSetup();
    expect(screen.getByText("Login Page")).toBeInTheDocument();
  });

  it("redirects to /vehicles when already logged in", () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: "admin", role: "admin" },
      loading: false,
      setupNeeded: false,
      login: vi.fn(),
      logout: vi.fn(),
      completeSetup: vi.fn(),
    });
    renderSetup();
    expect(screen.getByText("Vehicles Page")).toBeInTheDocument();
  });

  it("shows an error when passwords do not match", async () => {
    const user = userEvent.setup();
    renderSetup();

    await user.type(screen.getByLabelText(/^username/i), "admin");
    await user.type(screen.getByLabelText(/^password/i), "password123");
    await user.type(screen.getByLabelText(/confirm password/i), "different456");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
  });

  it("does not call completeSetup when passwords do not match", async () => {
    const user = userEvent.setup();
    const completeSetup = vi.fn();
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      setupNeeded: true,
      login: vi.fn(),
      logout: vi.fn(),
      completeSetup,
    });
    renderSetup();

    await user.type(screen.getByLabelText(/^username/i), "admin");
    await user.type(screen.getByLabelText(/^password/i), "password123");
    await user.type(screen.getByLabelText(/confirm password/i), "different456");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(completeSetup).not.toHaveBeenCalled();
  });

  it("calls completeSetup with username and password when form is valid", async () => {
    const user = userEvent.setup();
    const completeSetup = vi.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      setupNeeded: true,
      login: vi.fn(),
      logout: vi.fn(),
      completeSetup,
    });
    renderSetup();

    await user.type(screen.getByLabelText(/^username/i), "admin");
    await user.type(screen.getByLabelText(/^password/i), "password123");
    await user.type(screen.getByLabelText(/confirm password/i), "password123");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() =>
      expect(completeSetup).toHaveBeenCalledWith("admin", "password123")
    );
  });

  it("displays a server error message when setup fails", async () => {
    const user = userEvent.setup();
    const completeSetup = vi.fn().mockRejectedValue(new Error("Setup already complete"));
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      setupNeeded: true,
      login: vi.fn(),
      logout: vi.fn(),
      completeSetup,
    });
    renderSetup();

    await user.type(screen.getByLabelText(/^username/i), "admin");
    await user.type(screen.getByLabelText(/^password/i), "password123");
    await user.type(screen.getByLabelText(/confirm password/i), "password123");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() =>
      expect(screen.getByText(/setup already complete/i)).toBeInTheDocument()
    );
  });
});
