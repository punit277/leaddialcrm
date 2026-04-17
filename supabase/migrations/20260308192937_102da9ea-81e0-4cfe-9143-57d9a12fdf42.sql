
INSERT INTO public.user_roles (user_id, role)
VALUES ('9b5adda9-f132-4e28-817e-a9c6e15331b6', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
