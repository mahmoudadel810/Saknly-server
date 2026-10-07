import bcrypt from 'bcryptjs';


//hash the password

export const hashFunction = ({
    payload = "",
    saltRounds = process.env.SALT_ROUNDS,
}) =>
{
    const rounds = Number(saltRounds);
    const hashedPassword = bcrypt.hashSync(payload, Number.isInteger(rounds) && rounds >= 8 && rounds <= 15 ? rounds : 10);
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