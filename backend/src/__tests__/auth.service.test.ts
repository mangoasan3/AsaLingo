import crypto from "crypto";
import { RefreshToken } from "../models";
import { issueTokens, logoutUser, refreshTokens } from "../modules/auth/auth.service";
import {
  getRefreshExpiryDate,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt";

jest.mock("../models", () => ({
  User: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
  RefreshToken: {
    create: jest.fn(),
    findOne: jest.fn(),
    deleteOne: jest.fn(),
    deleteMany: jest.fn(),
  },
}));

jest.mock("../utils/jwt", () => ({
  signAccessToken: jest.fn(),
  signRefreshToken: jest.fn(),
  verifyRefreshToken: jest.fn(),
  getRefreshExpiryDate: jest.fn(),
}));

const mockedRefreshToken = jest.mocked(RefreshToken);
const mockedSignAccessToken = jest.mocked(signAccessToken);
const mockedSignRefreshToken = jest.mocked(signRefreshToken);
const mockedVerifyRefreshToken = jest.mocked(verifyRefreshToken);
const mockedGetRefreshExpiryDate = jest.mocked(getRefreshExpiryDate);

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

describe("auth refresh token storage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetRefreshExpiryDate.mockReturnValue(new Date("2030-01-01T00:00:00.000Z"));
  });

  test("issued token is stored hashed", async () => {
    mockedSignAccessToken.mockReturnValue("access-token");
    mockedSignRefreshToken.mockReturnValue("refresh-token");

    const tokens = await issueTokens("user-1", "learner@example.com");

    expect(tokens).toEqual({
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });
    expect(mockedRefreshToken.create).toHaveBeenCalledWith({
      token: sha256("refresh-token"),
      userId: "user-1",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });
  });

  test("refresh succeeds with a valid hashed token", async () => {
    mockedVerifyRefreshToken.mockReturnValue({
      sub: "user-1",
      email: "learner@example.com",
    });
    mockedRefreshToken.findOne.mockResolvedValue({
      _id: "stored-token",
      token: sha256("old-refresh-token"),
      expiresAt: new Date("2030-01-02T00:00:00.000Z"),
    });
    mockedSignAccessToken.mockReturnValue("new-access-token");
    mockedSignRefreshToken.mockReturnValue("new-refresh-token");

    const tokens = await refreshTokens("old-refresh-token");

    expect(mockedRefreshToken.findOne).toHaveBeenCalledWith({
      $or: [{ token: sha256("old-refresh-token") }, { token: "old-refresh-token" }],
    });
    expect(mockedRefreshToken.deleteOne).toHaveBeenCalledWith({ _id: "stored-token" });
    expect(mockedRefreshToken.create).toHaveBeenCalledWith({
      token: sha256("new-refresh-token"),
      userId: "user-1",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });
    expect(tokens).toEqual({
      accessToken: "new-access-token",
      refreshToken: "new-refresh-token",
    });
  });

  test("invalid or rotated token is rejected", async () => {
    mockedVerifyRefreshToken.mockReturnValue({
      sub: "user-1",
      email: "learner@example.com",
    });
    mockedRefreshToken.findOne.mockResolvedValue(null);

    await expect(refreshTokens("rotated-token")).rejects.toMatchObject({
      message: "Invalid or expired refresh token",
      statusCode: 401,
    });
  });

  test("logout removes the hashed token lookup", async () => {
    await logoutUser("user-1", "refresh-token");

    expect(mockedRefreshToken.deleteOne).toHaveBeenCalledWith({
      userId: "user-1",
      $or: [{ token: sha256("refresh-token") }, { token: "refresh-token" }],
    });
  });
});
