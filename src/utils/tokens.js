require('dotenv').config();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const ACCESS_SECRET = process.env.ACCESS_TOKEN_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_EXP = process.env.ACCESS_TOKEN_EXPIRES_IN || '15m';
const REFRESH_EXP = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

function generateAccessToken(payload){
    return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXP });
}

function generateRefreshToken(payload){
    return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXP });
}

function verifyAccessToken(token){
    return jwt.verify(token, ACCESS_SECRET);
}

function verifyRefreshToken(token){
    return jwt.verify(token, REFRESH_SECRET);
}

function getRefreshTokenExpiry(){
    return null;
}

function randomTokenString(){
    return crypto.randomBytes(64).toString('hex');
}

function refreshExpMs(){
    const raw = REFRESH_EXP;
    if (raw.endsWith('d')) return parseInt(raw) * 24 * 60 * 60 * 1000;
    if (raw.endsWith('h')) return parseInt(raw) * 60 * 60 * 1000;
    if (raw.endsWith('m')) return parseInt(raw) * 60 * 1000;
    return 7 * 24 * 60 * 60 * 1000;
}

function expiryDateFromNow(){
    return new Date(Date.now() + refreshExpMs());
}

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
    getRefreshTokenExpiry,
    randomTokenString,
    refreshExpMs,
    expiryDateFromNow
}