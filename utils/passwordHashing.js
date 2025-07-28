import bcrypt from 'bcryptjs';


//hash the password

export const hashFunction = ({
    payload = "",
    saltRounds = process.env.SALT_ROUNDS,
}) =>
{
    const hashedPassword = bcrypt.hashSync(payload, +saltRounds);
    return hashedPassword;
}

//compare the password already hashed


export const compareFunction = ({
    payload = "",
    referenceData = "",
}) =>
{
    const isMatch = bcrypt.compareSync(payload, referenceData);
    return isMatch;
}