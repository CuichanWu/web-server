import {
    createBuyer,
    createMerchant,
    createAdmin,
} from './users-dao.js';
import bcrypt from 'bcryptjs';
import * as usersDao from "./users-dao.js";


export const AuthController = (app) => {
    app.post('/users/signup', signup);
    app.post('/users/login', login);
    app.put('/users/changePassword', changePassword);
    app.post("/users/profile", profile);
    app.post("/users/logout",  logout);
}

// Sign up -- enter [name, email, password, role], return [newUser]
export const signup = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        // Check if user with same email exists
        const existingUser = await findUserByEmail(email);
        console.log(existingUser);
        if (existingUser ) {
            return res.status(409).json({ message: 'User with same email already exists' });
        }

        // hash
        const hashedPassword = await bcrypt.hash(password, 10);

        // build new user
        const newUser = { name, email, password: hashedPassword };
        let createdUser = null;
        if (role === "buyer") {
            createdUser = await createBuyer(newUser);
        }
        else if (role === "merchant") {
            createdUser = await createMerchant(newUser);
        }
        else if (role === "admin") {
            createdUser = await createAdmin(newUser);
        }

        // return success response
        req.session["currentUser"] = newUser;
        res.json(newUser);
    } catch (error) {
        res.status(500).json({ message: 'Error creating user' });
    }
};


// Login -- enter [email, password], return [user]
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. Check if user exists （in each role）
        let user = null;
        user = await findUserByEmail(email);

        if (!user) {
            return res.status(404).json({ message: 'User does not exist' });
        }

        // 2. Check if password is correct
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ message: 'Wrong password' });
        }

        // 4. Return success response
        req.session["currentUser"] = user;
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Error logging in' });
    }
};

// Profile
const profile = async (req, res) => {
    const currentUser = req.session["currentUser"];
    if (!currentUser) {
        res.sendStatus(404);
        return;
    }
    res.json(currentUser);
};

// Logout
const logout = async (req, res) => {
    req.session.destroy();
    res.sendStatus(200)
};


// Change password -- enter [oldPassword, newPassword]
export const changePassword = async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;

        // Check if user logged in
        const currentUser = req.session["currentUser"];
        if (!currentUser) {
            res.sendStatus(404);
            return;
        }

        // Compare
        const isMatch = await bcrypt.compare(oldPassword, currentUser.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Incorrect old password' });
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update the user's password in the database
        await updateUserPassword(currentUser, hashedPassword);

        // Return success message
        res.json({ message: 'Password updated successfully' });

    } catch (error) {
        res.status(500).json({ message: 'Error changing password' });
    }
};



// utility function
const findUserByEmail = async (email) => {
    const users = await usersDao.findUserByEmail(email);
    return users[0];
}

// c. Update -- return null when unsuccessful
const updateUserPassword = async (user, password) => {
    const id = user._id;
    const role = user.role;

    if (role === 'buyer') {
        await usersDao.updateBuyer(id, {password})
    }
    else if (role === 'merchant') {
        await usersDao.updateMerchant(id, {password})
    }
    else if (role === 'admin') {
        await usersDao.updateAdmin(id, {password})
    }
}