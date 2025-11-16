import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../App.jsx";
import Login from "../Login.jsx";
import { MOCK_USERS } from "../../data/mockUsers.js";

const renderLogin = (props = {}) =>
  render(
    <MemoryRouter>
      <Login
        isDark={false}
        onToggleTheme={vi.fn()}
        onLoginSuccess={vi.fn()}
        isAuthenticated={false}
        {...props}
      />
    </MemoryRouter>
  );

describe("Funcionalidad del Login", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
  });

  it("iniciar en modo claro y cambiar el tema para ver si persiste la preferencia.", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => expect(localStorage.getItem("theme")).toBe("light"));
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    const darkModeButton = screen.getByRole("button", { name: /modo oscuro/i });
    await user.click(darkModeButton);

    await waitFor(() =>
      expect(document.documentElement.classList.contains("dark")).toBe(true)
    );
    await waitFor(() => expect(localStorage.getItem("theme")).toBe("dark"));

    const lightModeButton = screen.getByRole("button", { name: /modo claro/i });
    await user.click(lightModeButton);

    await waitFor(() =>
      expect(document.documentElement.classList.contains("dark")).toBe(false)
    );
    await waitFor(() => expect(localStorage.getItem("theme")).toBe("light"));
  });

  it("permite el acceso con el usuario demo super admin.", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    );

    await user.type(
      screen.getByLabelText(/correo electronico/i),
      "superadmin@empresa.com"
    );
    await user.type(screen.getByLabelText(/contrasena/i), "Super123*");
    await user.click(
      screen.getByRole("button", { name: /ingresar al sistema/i })
    );

    await screen.findByRole("heading", { name: /panel de control/i });
  });

  it("no inicia sesion cuando el email y el password estan vacios.", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(
      screen.getByRole("button", { name: /ingresar al sistema/i })
    );

    expect(
      screen.getByText(/completa el correo y la contrasena/i)
    ).toBeInTheDocument();
  });

  it("valida el formato email antes de intentar iniciar sesion", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText(/correo electronico/i), "admin");
    await user.type(screen.getByLabelText(/contrasena/i), "Super123*");
    await user.click(
      screen.getByRole("button", { name: /ingresar al sistema/i })
    );

    expect(screen.getByText(/ingresa un correo valido/i)).toBeInTheDocument();
  });

  it("se requiere un password seguro (8+ caracteres, mayuscula, minuscula, numero y simbolo)", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.type(
      screen.getByLabelText(/correo electronico/i),
      "superadmin@empresa.com"
    );
    await user.type(screen.getByLabelText(/contrasena/i), "Sup1234"); // sin simbolo y corta
    await user.click(
      screen.getByRole("button", { name: /ingresar al sistema/i })
    );

    expect(
      screen.getByText(
        /la contrasena debe tener al menos 8 caracteres, incluir mayusculas, minusculas, numeros y simbolos/i,
      )
    ).toBeInTheDocument();
  });

  it("rechaza credenciales validas que no pertenezcan a los usuarios demo.", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.type(
      screen.getByLabelText(/correo electronico/i),
      "otro@empresa.com"
    );
    await user.type(screen.getByLabelText(/contrasena/i), "Super123*");
    await user.click(
      screen.getByRole("button", { name: /ingresar al sistema/i })
    );

    expect(
      screen.getByText(/credenciales invalidas/i)
    ).toBeInTheDocument();
  });

  it.each(
    MOCK_USERS.map(({ role, email, password }) => [role, email, password])
  )("permite iniciar sesion con el rol demo %s", async (_role, email, password) => {
    const user = userEvent.setup();
    const onLoginSuccess = vi.fn();
    renderLogin({ onLoginSuccess });

    await user.type(screen.getByLabelText(/correo electronico/i), email);
    await user.type(screen.getByLabelText(/contrasena/i), password);
    await user.click(screen.getByRole("button", { name: /ingresar al sistema/i }));

    expect(onLoginSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ email, role: _role })
    );
    expect(screen.queryByText(/credenciales invalidas/i)).toBeNull();
  });
});
